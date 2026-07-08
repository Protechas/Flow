"""Library Validation Engine — validate external reports against audited SI Library data.

Additive analysis only. Does not modify audit matching or compliance calculations.
"""

from __future__ import annotations

import os
import re
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from io import BytesIO
from typing import Any

import pandas as pd

from .audit_engine import (
    MATCH_EXACT,
    MATCH_MISSING,
    MATCH_POTENTIAL_MISMATCH,
    MATCH_SPLIT_NAMING,
    MATCH_SPLIT_PRESENT,
    SYSTEM_FAMILY_ALIASES,
    extract_system_root_from_row,
)
from .rollup_engine import AUDIT_RESULTS_SHEET

MAX_IO_WORKERS = min(8, (os.cpu_count() or 4) + 2)

CLASS_LIBRARY_EXISTS = "Library File Exists"
CLASS_TRUE_MISSING = "True Missing From Library"
CLASS_PCS_MAPPING = "PCS / Mapping Review Candidate"
CLASS_NAMING_REVIEW = "Naming Review Required"
CLASS_CLASSIFICATION_REVIEW = "Classification Review Required"
CLASS_NO_RECORD = "No Matching Expected Record"
CLASS_MANUAL_REVIEW = "Manual Review Required"

STATUS_TO_CLASSIFICATION: dict[str, str] = {
    MATCH_EXACT: CLASS_LIBRARY_EXISTS,
    MATCH_SPLIT_PRESENT: CLASS_PCS_MAPPING,
    MATCH_MISSING: CLASS_TRUE_MISSING,
    MATCH_SPLIT_NAMING: CLASS_NAMING_REVIEW,
    MATCH_POTENTIAL_MISMATCH: CLASS_CLASSIFICATION_REVIEW,
}

STATUS_TO_CONFIDENCE: dict[str, int] = {
    MATCH_EXACT: 100,
    MATCH_SPLIT_PRESENT: 95,
    MATCH_POTENTIAL_MISMATCH: 60,
    MATCH_MISSING: 0,
    MATCH_SPLIT_NAMING: 60,
}

COLUMN_ALIASES: dict[str, list[str]] = {
    "Year": ["year", "model year", "yr", "vehicle year"],
    "Make": ["make", "manufacturer", "oem", "brand", "mfg"],
    "Model": ["model", "vehicle model", "vehicle"],
    "Raw Model": ["raw model", "model name", "model description"],
    "Name": ["name", "file name", "filename", "document name", "document"],
    "ADAS System": ["adas system", "adas", "system name", "calibration system"],
    "System": ["system", "generic system", "sme generic system name", "sme system"],
    "Feature": ["feature", "calibration feature", "cal type"],
    "VIN": ["vin", "vehicle vin", "vin number"],
    "Repair Order": ["repair order", "ro", "ro number", "ro #", "repair order number", "ro num"],
}

RESULT_COLUMNS = [
    "Repair Order",
    "VIN",
    "Year",
    "Make",
    "Model",
    "System",
    "Original System Name",
    "Matched Audit Status",
    "Validation Classification",
    "Confidence",
    "Evidence / Match Notes",
    "Expected Filename",
    "Actual / Closest Filename",
]


@dataclass
class LibraryValidationSummary:
    records_validated: int = 0
    rows_matched_to_audit: int = 0
    appear_compliant: int = 0
    library_file_exists: int = 0
    true_missing: int = 0
    pcs_mapping_review: int = 0
    naming_review: int = 0
    classification_review: int = 0
    no_matching_record: int = 0
    manual_review: int = 0
    top_systems: pd.DataFrame = field(default_factory=pd.DataFrame)
    top_models: pd.DataFrame = field(default_factory=pd.DataFrame)


@dataclass
class LibraryValidationResult:
    summary: LibraryValidationSummary
    detailed_results: pd.DataFrame
    source_upload: pd.DataFrame
    source_filename: str = ""
    detected_columns: dict[str, str] = field(default_factory=dict)


def _normalize_header(value: Any) -> str:
    text = str(value).strip().lower()
    return re.sub(r"\s+", " ", text)


def _clean_cell(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    return str(value).strip()


def detect_upload_columns(df: pd.DataFrame) -> dict[str, str]:
    if df.empty:
        return {}
    normalized = {_normalize_header(col): col for col in df.columns}
    resolved: dict[str, str] = {}
    for canonical, aliases in COLUMN_ALIASES.items():
        candidates = [_normalize_header(canonical)] + [_normalize_header(a) for a in aliases]
        for candidate in candidates:
            if candidate in normalized:
                resolved[canonical] = normalized[candidate]
                break
    return resolved


def _looks_like_filename(value: str) -> bool:
    lower = value.lower()
    return ".pdf" in lower or ".xlsx" in lower or bool(re.search(r"\d{4}\s+[a-z]", lower))


def _system_value(row: pd.Series, column_map: dict[str, str]) -> tuple[str, str]:
    for key in ("ADAS System", "System", "Feature"):
        col = column_map.get(key)
        if col and _clean_cell(row.get(col)):
            val = _clean_cell(row.get(col))
            return val, val
    name_col = column_map.get("Name")
    if name_col:
        name_val = _clean_cell(row.get(name_col))
        if name_val and not _looks_like_filename(name_val):
            return name_val, name_val
    return "", ""


def _row_dict_for_system(system_value: str, feature_value: str = "") -> dict[str, str]:
    return {
        "SME Generic System Name": system_value,
        "Feature": feature_value or system_value,
        "Is Placeholder": "No",
        "Placeholder Code": "",
    }


def _system_family(root: str) -> frozenset[str]:
    root = root.upper()
    if not root:
        return frozenset()
    family = {root}
    family.update(SYSTEM_FAMILY_ALIASES.get(root, set()))
    for key, aliases in SYSTEM_FAMILY_ALIASES.items():
        if root in aliases:
            family.add(key)
            family.update(aliases)
    return frozenset(family)


def _system_roots_compatible(left: str, right: str) -> bool:
    if not left or not right:
        return False
    return bool(_system_family(left) & _system_family(right))


def _model_mask(scoped: pd.DataFrame, upload_model: str) -> pd.Series:
    model_lower = _clean_cell(upload_model).lower()
    if not model_lower:
        return pd.Series(True, index=scoped.index)
    mask = pd.Series(False, index=scoped.index)
    for col in ("Normalized Model", "Raw Model", "Model"):
        if col not in scoped.columns:
            continue
        values = scoped[col].astype(str).str.lower().str.strip()
        mask |= (values == model_lower) | values.str.contains(model_lower, na=False, regex=False)
    return mask


def _system_root_mask(scoped: pd.DataFrame, upload_root: str) -> pd.Series:
    if not upload_root:
        return pd.Series(True, index=scoped.index)
    upload_family = _system_family(upload_root)
    roots = scoped.get("System Root", pd.Series("", index=scoped.index)).astype(str).str.upper()
    return roots.map(lambda root: bool(upload_family & _system_family(root)) if root else False)


def _prepare_audit_frame(manufacturer: str, workbook_bytes: bytes) -> pd.DataFrame | None:
    """Read the Audit Results sheet from one audit workbook and tag it."""
    try:
        workbook = pd.ExcelFile(BytesIO(workbook_bytes))
        if AUDIT_RESULTS_SHEET not in workbook.sheet_names:
            return None
        audit_df = pd.read_excel(workbook, sheet_name=AUDIT_RESULTS_SHEET, dtype=str)
    except Exception:
        return None
    if audit_df.empty:
        return None
    frame = audit_df.copy()
    frame["Repository Manufacturer"] = manufacturer
    frame["System Root"] = frame.apply(
        lambda row: extract_system_root_from_row(row.to_dict()) or "UNKNOWN",
        axis=1,
    )
    return frame


def build_audit_database(audits: list[dict[str, Any]]) -> pd.DataFrame:
    """Assemble the audited-library database from per-manufacturer audit workbooks.

    Each entry: {"manufacturer": str, "workbook_bytes": bytes}. This replaces the
    Streamlit tool's SQLite repository + disk cache — the caller (Flow's job
    pipeline) supplies the latest completed audit workbook per manufacturer.
    """
    frames: list[pd.DataFrame] = []
    if audits:
        with ThreadPoolExecutor(max_workers=MAX_IO_WORKERS) as pool:
            futures = [
                pool.submit(_prepare_audit_frame, str(a.get("manufacturer") or ""), a["workbook_bytes"])
                for a in audits
            ]
            for future in futures:
                frame = future.result()
                if frame is not None:
                    frames.append(frame)
    return pd.concat(frames, ignore_index=True) if frames else pd.DataFrame()


def _read_upload(file_bytes: bytes, filename: str) -> pd.DataFrame:
    buffer = BytesIO(file_bytes)
    lower = filename.lower()
    if lower.endswith(".csv"):
        return pd.read_csv(buffer, dtype=str)
    if lower.endswith(".xlsx") or lower.endswith(".xls"):
        workbook = pd.ExcelFile(buffer)
        best_sheet = workbook.sheet_names[0]
        best_score = -1
        for sheet in workbook.sheet_names:
            sample = pd.read_excel(workbook, sheet_name=sheet, dtype=str, nrows=5)
            score = len(detect_upload_columns(sample))
            if score > best_score:
                best_score = score
                best_sheet = sheet
        return pd.read_excel(workbook, sheet_name=best_sheet, dtype=str)
    raise ValueError("Unsupported file type. Upload Excel (.xlsx, .xls) or CSV (.csv).")


def _normalize_upload_rows(df: pd.DataFrame, column_map: dict[str, str]) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    for idx, row in df.iterrows():
        year_col = column_map.get("Year")
        make_col = column_map.get("Make")
        model_col = column_map.get("Model") or column_map.get("Raw Model")
        raw_model_col = column_map.get("Raw Model")
        vin_col = column_map.get("VIN")
        ro_col = column_map.get("Repair Order")
        system_value, original_system = _system_value(row, column_map)
        model_value = _clean_cell(row.get(model_col)) if model_col else ""
        raw_model_value = _clean_cell(row.get(raw_model_col)) if raw_model_col else model_value
        rows.append(
            {
                "Source Row": int(idx) + 2,
                "Repair Order": _clean_cell(row.get(ro_col)) if ro_col else "",
                "VIN": _clean_cell(row.get(vin_col)) if vin_col else "",
                "Year": _clean_cell(row.get(year_col)) if year_col else "",
                "Make": _clean_cell(row.get(make_col)) if make_col else "",
                "Model": model_value or raw_model_value,
                "Raw Model": raw_model_value or model_value,
                "System": extract_system_root_from_row(_row_dict_for_system(system_value)) or system_value,
                "Original System Name": original_system,
                "Original Row Data": " | ".join(
                    f"{col}={_clean_cell(row.get(col))}"
                    for col in df.columns
                    if _clean_cell(row.get(col))
                ),
            }
        )
    return pd.DataFrame(rows)


def _scope_audit_rows(upload_make: str, audit_db: pd.DataFrame) -> pd.DataFrame:
    if audit_db.empty:
        return audit_db
    if not upload_make:
        return audit_db

    make_lower = upload_make.lower()
    repo_series = audit_db.get("Repository Manufacturer", pd.Series(dtype=str)).astype(str).str.lower()
    make_series = audit_db.get("Make", pd.Series(dtype=str)).astype(str).str.lower()

    scoped = audit_db[(repo_series == make_lower) | (make_series == make_lower)]
    if not scoped.empty:
        return scoped

    return audit_db[
        repo_series.str.contains(make_lower, na=False, regex=False)
        | make_series.str.contains(make_lower, na=False, regex=False)
    ]


def _find_audit_match(normalized_row: pd.Series, audit_db: pd.DataFrame) -> pd.Series | None:
    if audit_db.empty:
        return None

    scoped = _scope_audit_rows(_clean_cell(normalized_row.get("Make")), audit_db)
    if scoped.empty:
        return None

    upload_year = _clean_cell(normalized_row.get("Year"))
    upload_model = _clean_cell(normalized_row.get("Model")) or _clean_cell(normalized_row.get("Raw Model"))
    upload_system = _clean_cell(normalized_row.get("System"))
    system_dict = _row_dict_for_system(
        _clean_cell(normalized_row.get("Original System Name")),
        upload_system,
    )
    upload_root = extract_system_root_from_row(system_dict) or upload_system.upper()

    if upload_year:
        year_matches = scoped[scoped["Year"].astype(str).map(_clean_cell) == upload_year]
        if not year_matches.empty:
            scoped = year_matches

    scores = pd.Series(0, index=scoped.index, dtype=int)
    if upload_year:
        scores += scoped["Year"].astype(str).map(_clean_cell).eq(upload_year).astype(int) * 3
    else:
        scores += 1

    if upload_model:
        scores += _model_mask(scoped, upload_model).astype(int) * 3
    else:
        scores += 1

    if upload_root:
        scores += _system_root_mask(scoped, upload_root).astype(int) * 4
    else:
        scores += 1

    if scores.empty:
        return None
    best_score = int(scores.max())
    if best_score < 4:
        return None
    return scoped.loc[scores.idxmax()]


def _validate_upload_row(row: pd.Series, audit_db: pd.DataFrame) -> dict[str, Any]:
    audit_match = _find_audit_match(row, audit_db)
    classification = _classify_row(row, audit_match)
    return {
        "Repair Order": row.get("Repair Order", ""),
        "VIN": row.get("VIN", ""),
        "Year": row.get("Year", ""),
        "Make": row.get("Make", ""),
        "Model": row.get("Model", ""),
        "System": row.get("System", ""),
        "Original System Name": row.get("Original System Name", ""),
        **classification,
        "Source Row": row.get("Source Row"),
        "Original Row Data": row.get("Original Row Data", ""),
    }


def _classify_row(normalized_row: pd.Series, audit_match: pd.Series | None) -> dict[str, Any]:
    if audit_match is None:
        return {
            "Matched Audit Status": "",
            "Validation Classification": CLASS_NO_RECORD,
            "Confidence": 40,
            "Evidence / Match Notes": "No matching MC expected record found in latest audited SI Library.",
            "Expected Filename": "",
            "Actual / Closest Filename": "",
        }

    status = _clean_cell(audit_match.get("Match Status"))
    classification = STATUS_TO_CLASSIFICATION.get(status, CLASS_MANUAL_REVIEW)
    confidence = STATUS_TO_CONFIDENCE.get(status, 25)
    notes = _clean_cell(audit_match.get("Match Notes"))
    expected = _clean_cell(audit_match.get("Expected Filename"))
    actual = _clean_cell(audit_match.get("Actual Filename(s)")) or _clean_cell(audit_match.get("Actual Filename"))

    evidence = notes or f"Matched latest audit status: {status}."
    if classification == CLASS_LIBRARY_EXISTS:
        evidence = f"{evidence} Expected library file appears present in latest audit.".strip()
    elif classification == CLASS_PCS_MAPPING:
        evidence = (
            f"{evidence} Library split file present; failure may reflect PCS attachment or mapping."
        ).strip()
    elif classification == CLASS_TRUE_MISSING:
        evidence = f"{evidence} Expected deliverable missing from audited OneDrive export.".strip()
    elif classification == CLASS_NAMING_REVIEW:
        evidence = f"{evidence} Naming difference detected in latest audit.".strip()
    elif classification == CLASS_CLASSIFICATION_REVIEW:
        evidence = f"{evidence} Classification or naming mismatch detected in latest audit.".strip()

    return {
        "Matched Audit Status": status,
        "Validation Classification": classification,
        "Confidence": confidence,
        "Evidence / Match Notes": evidence,
        "Expected Filename": expected,
        "Actual / Closest Filename": actual,
    }


def _top_counts(df: pd.DataFrame, column: str, limit: int = 10) -> pd.DataFrame:
    if df.empty or column not in df.columns:
        return pd.DataFrame(columns=[column.title(), "Count"])
    counts = (
        df[column].replace("", "Unknown").value_counts().head(limit).reset_index()
    )
    counts.columns = [column.title(), "Count"]
    return counts


def _build_summary(results: pd.DataFrame, uploaded_rows: int) -> LibraryValidationSummary:
    if results.empty:
        return LibraryValidationSummary(records_validated=uploaded_rows)

    matched = int((results["Matched Audit Status"].astype(str).str.strip() != "").sum())
    classes = results["Validation Classification"].value_counts()
    library_exists = int(classes.get(CLASS_LIBRARY_EXISTS, 0))
    return LibraryValidationSummary(
        records_validated=uploaded_rows,
        rows_matched_to_audit=matched,
        appear_compliant=library_exists,
        library_file_exists=library_exists,
        true_missing=int(classes.get(CLASS_TRUE_MISSING, 0)),
        pcs_mapping_review=int(classes.get(CLASS_PCS_MAPPING, 0)),
        naming_review=int(classes.get(CLASS_NAMING_REVIEW, 0)),
        classification_review=int(classes.get(CLASS_CLASSIFICATION_REVIEW, 0)),
        no_matching_record=int(classes.get(CLASS_NO_RECORD, 0)),
        manual_review=int(classes.get(CLASS_MANUAL_REVIEW, 0))
        + int(classes.get(CLASS_NO_RECORD, 0))
        + int(classes.get(CLASS_CLASSIFICATION_REVIEW, 0)),
        top_systems=_top_counts(results, "System"),
        top_models=_top_counts(results, "Model"),
    )


def validate_external_report(
    file_bytes: bytes, filename: str, audit_db: pd.DataFrame
) -> LibraryValidationResult:
    """Validate an uploaded external report against the audited SI Library.

    `audit_db` comes from build_audit_database() — the caller owns persistence.
    """
    source_df = _read_upload(file_bytes, filename)
    column_map = detect_upload_columns(source_df)
    normalized = _normalize_upload_rows(source_df, column_map)
    row_list = [normalized.loc[idx] for idx in normalized.index]

    if len(row_list) > 75:
        workers = min(MAX_IO_WORKERS, max(2, (os.cpu_count() or 4)))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            result_rows = list(pool.map(lambda row: _validate_upload_row(row, audit_db), row_list))
    else:
        result_rows = [_validate_upload_row(row, audit_db) for row in row_list]

    detailed = pd.DataFrame(result_rows)
    if not detailed.empty:
        detailed = detailed[RESULT_COLUMNS + ["Source Row", "Original Row Data"]]

    summary = _build_summary(detailed, uploaded_rows=len(source_df))
    return LibraryValidationResult(
        summary=summary,
        detailed_results=detailed,
        source_upload=source_df,
        source_filename=filename,
        detected_columns=column_map,
    )
