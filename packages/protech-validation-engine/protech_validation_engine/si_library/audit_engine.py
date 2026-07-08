"""Core audit logic for the SI Library Audit Tool."""

from __future__ import annotations

import re
from collections import Counter
from copy import deepcopy
from dataclasses import dataclass
from io import BytesIO
from typing import TYPE_CHECKING, Any

import pandas as pd

if TYPE_CHECKING:
    from .config import AuditSettings

# Manufacturer chart columns (flexible matching on header text)
MC_REQUIRED_COLUMNS = [
    "Year",
    "Make",
    "Model",
    "Feature",
    "Calibration Type",
    "SME Generic System Name",
    "Tertiary Key",
]

MC_COLUMN_ALIASES: dict[str, list[str]] = {
    "Year": ["year", "model year", "yr"],
    "Make": ["make", "manufacturer", "oem"],
    "Model": ["model", "vehicle model"],
    "Feature": ["feature", "adas feature"],
    "Calibration Type": ["calibration type", "cal type", "calibration"],
    "SME Generic System Name": [
        "sme generic system name",
        "generic system name",
        "system name",
        "sme system name",
    ],
    "Tertiary Key": ["tertiary key", "tertiary", "tertiary key value"],
}

ONEDRIVE_REQUIRED_COLUMNS = ["Name", "Item Type"]
ONEDRIVE_OPTIONAL_COLUMNS = ["Path"]
ONEDRIVE_COLUMN_ALIASES: dict[str, list[str]] = {
    "Name": ["name", "file name", "filename"],
    "Item Type": ["item type", "type"],
    "Path": ["path", "folder path", "file path", "parent path", "onedrive path"],
}

MATCH_EXACT = "Exact Match"
MATCH_SPLIT_PRESENT = "Split File Present"
MATCH_SPLIT_NAMING = "Split File Naming Difference"
MATCH_POTENTIAL_MISMATCH = "Potential Classification/Naming Mismatch"
MATCH_MISSING = "Missing From OneDrive Export"

FILENAME_REPAIR_NOTE = "Expected filename normalized before comparison"

ISSUE_OWNER_MAP = {
    MATCH_EXACT: "Compliant",
    MATCH_SPLIT_PRESENT: "Compliant / PCS Review",
    MATCH_SPLIT_NAMING: "SI Naming Review",
    MATCH_POTENTIAL_MISMATCH: "Needs Human Review",
    MATCH_MISSING: "SI / Export Gap Review",
}

PASSING_STATUSES = {MATCH_EXACT, MATCH_SPLIT_PRESENT}
REVIEW_STATUSES = {
    MATCH_SPLIT_PRESENT,
    MATCH_SPLIT_NAMING,
    MATCH_POTENTIAL_MISMATCH,
    MATCH_MISSING,
}

SPLIT_PATTERNS = [
    r"\bpart\s*\d+\b",
    r"\bpt\.?\s*\d+\b",
    r"\bsplit\s*\d+\b",
    r"\bsection\s*\d+\b",
    r"[-_]\s*\d+\s*$",
    r"\(\s*\d+\s*of\s*\d+\s*\)",
    r"\b\d+\s*of\s*\d+\b",
]

SOP_SPLIT_PATTERN = re.compile(r"-Part-\d+")
NON_SOP_SPLIT_PATTERN = re.compile(
    r"(?:\bPart\s*\d+\b|\bpart-\d+\b|-part-\d+\b|\bpt\.?\s*\d+\b)",
    re.IGNORECASE,
)

SYSTEM_FAMILY_ALIASES: dict[str, set[str]] = {
    "NV": {"NV"},
    "ACC": {"ACC", "FRS"},
    "AEB": {"AEB", "FRS"},
    "BSW": {"BSW", "RCTW", "RRS"},
    "LKA": {"LKA", "WSC"},
    "SVC": {"SVC"},
    "APA": {"APA", "PDS"},
    "BUC": {"BUC"},
    "FRS": {"FRS", "ACC", "AEB"},
    "RRS": {"RRS", "BSW", "RCTW"},
    "WSC": {"WSC", "LKA"},
    "PDS": {"PDS", "APA"},
    "RCTW": {"RCTW", "BSW"},
}


class AuditValidationError(Exception):
    """Raised when uploaded files are missing required structure."""


@dataclass
class AuditResult:
    manufacturer: str
    expected_df: pd.DataFrame
    onedrive_df: pd.DataFrame
    audit_df: pd.DataFrame
    dashboard: dict[str, Any]
    method_notes: list[str]


def _normalize_header(value: Any) -> str:
    text = str(value).strip().lower()
    text = re.sub(r"\s+", " ", text)
    return text


def _resolve_columns(
    df: pd.DataFrame,
    required: list[str],
    aliases: dict[str, list[str]],
    *,
    optional: list[str] | None = None,
) -> dict[str, str]:
    """Map canonical column names to actual dataframe column names."""
    normalized = {_normalize_header(col): col for col in df.columns}
    resolved: dict[str, str] = {}

    for canonical in required:
        candidates = [_normalize_header(canonical)] + [
            _normalize_header(alias) for alias in aliases.get(canonical, [])
        ]
        match = None
        for candidate in candidates:
            if candidate in normalized:
                match = normalized[candidate]
                break
        if match:
            resolved[canonical] = match

    missing = [col for col in required if col not in resolved]
    if missing:
        found = ", ".join(str(c) for c in df.columns)
        raise AuditValidationError(
            f"Missing required column(s): {', '.join(missing)}. "
            f"Found columns: {found}"
        )

    for canonical in optional or []:
        candidates = [_normalize_header(canonical)] + [
            _normalize_header(alias) for alias in aliases.get(canonical, [])
        ]
        for candidate in candidates:
            if candidate in normalized:
                resolved[canonical] = normalized[candidate]
                break

    return resolved


def _clean_cell(value: Any) -> str:
    if pd.isna(value):
        return ""
    text = str(value).strip()
    if text.lower() in {"nan", "none", "nat"}:
        return ""
    return text


def _collapse_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _append_match_notes(*parts: str | None) -> str | None:
    notes = [part.strip() for part in parts if part and part.strip()]
    return "; ".join(notes) if notes else None


def normalize_system_component(system: str) -> str:
    """Normalize SME/system text to SOP form, e.g. ACC (2) -> ACC 2."""
    text = _clean_cell(system)
    if not text:
        return text

    text = _collapse_spaces(text)

    while text.startswith("(") and text.endswith(")"):
        inner = text[1:-1].strip()
        if ")" in inner:
            break
        text = _collapse_spaces(inner)

    text = text.strip("() ")
    text = _collapse_spaces(text)

    paren_match = re.fullmatch(r"(.+?)\s*\(\s*([^)]+?)\s*\)", text)
    if paren_match:
        name_part = _collapse_spaces(paren_match.group(1))
        inner_part = _collapse_spaces(paren_match.group(2))
        text = f"{name_part} {inner_part}"

    text = re.sub(r"^(.+?)\s+(\d+)\s*\)+$", r"\1 \2", text)
    text = text.replace("(", " ").replace(")", " ")
    return _collapse_spaces(text)


def normalize_expected_filename(filename: str) -> tuple[str, bool]:
    """Validate and repair expected filename syntax before matching."""
    original = _clean_cell(filename)
    if not original:
        return original, False

    repaired = original

    while re.search(r"\.pdf\.pdf$", repaired, flags=re.IGNORECASE):
        repaired = re.sub(r"\.pdf$", "", repaired, flags=re.IGNORECASE)

    repaired = re.sub(r"(\.pdf)+$", ".pdf", repaired, flags=re.IGNORECASE)
    if not repaired.lower().endswith(".pdf"):
        repaired = f"{repaired}.pdf"

    stem = repaired[:-4]
    stem = _collapse_spaces(stem)

    while "((" in stem:
        stem = stem.replace("((", "(")
    while "))" in stem:
        stem = stem.replace("))", ")")

    last_open = stem.rfind("(")
    last_close = stem.rfind(")")

    if last_open != -1:
        prefix = _collapse_spaces(stem[:last_open])
        trailing_suffix = ""
        if last_close > last_open:
            system_raw = stem[last_open + 1:last_close]
            trailing_suffix = stem[last_close + 1:].strip()
        else:
            system_raw = stem[last_open + 1:]

        system_clean = normalize_system_component(system_raw)
        stem = f"{prefix} ({system_clean})"
        if trailing_suffix:
            if not trailing_suffix.startswith(("-", " ")):
                trailing_suffix = f"-{trailing_suffix}"
            stem = f"{stem}{trailing_suffix}"
    elif last_close != -1:
        stem = stem.replace(")", "")

    stem = _collapse_spaces(stem)
    repaired = f"{stem}.pdf"

    return repaired, repaired != original


def _normalize_filename(name: str) -> str:
    sanitized, _ = normalize_expected_filename(name)
    text = _clean_cell(sanitized)
    if text.lower().endswith(".pdf"):
        text = text[:-4]
    text = text.lower()
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[^\w\s()./-]", "", text)
    return text.strip()


def _get_split_patterns(settings: AuditSettings | None = None) -> list[str]:
    if settings and settings.split_file_patterns:
        return settings.split_file_patterns
    return SPLIT_PATTERNS


def _apply_translation_rules(text: str, settings: AuditSettings | None = None) -> str:
    if not settings or not settings.filename_translation_rules:
        return text
    result = text
    for rule in settings.filename_translation_rules:
        find_text = str(rule.get("find", "")).strip()
        replace_text = str(rule.get("replace", ""))
        if find_text:
            result = result.replace(find_text, replace_text)
    return result


def _get_model_aliases(settings: AuditSettings | None = None) -> dict[str, dict[str, str]]:
    from .config import DEFAULT_MODEL_ALIASES

    merged = deepcopy(DEFAULT_MODEL_ALIASES)
    if settings and settings.model_aliases:
        for make, mappings in settings.model_aliases.items():
            merged.setdefault(make, {})
            merged[make].update(mappings)
    return merged


def _find_make_alias_map(make: str, settings: AuditSettings | None = None) -> dict[str, str]:
    aliases = _get_model_aliases(settings)
    if make in aliases:
        return aliases[make]

    make_lower = make.strip().lower()
    for make_key, model_map in aliases.items():
        if make_key.strip().lower() == make_lower:
            return model_map
    return {}


def _get_placeholder_filenames(settings: AuditSettings | None = None) -> dict[str, str]:
    from .config import DEFAULT_PLACEHOLDER_FILENAMES

    merged = deepcopy(DEFAULT_PLACEHOLDER_FILENAMES)
    if settings and settings.placeholder_filenames:
        merged.update({key.upper(): value for key, value in settings.placeholder_filenames.items()})
    return merged


def _has_classification_number(text: str) -> bool:
    cleaned = _clean_cell(text).rstrip(".")
    if not cleaned:
        return False
    normalized = normalize_system_component(cleaned)
    return bool(re.search(r"\d", normalized))


def _extract_feature_code(*values: str) -> str:
    for value in values:
        cleaned = _clean_cell(value).rstrip(".")
        if not cleaned or _has_classification_number(cleaned):
            continue
        token = re.sub(r"[^A-Za-z]", "", cleaned.split()[0])
        if token:
            return token.upper()
    return ""


def detect_placeholder_row(row: dict[str, str], settings: AuditSettings | None = None) -> tuple[bool, str]:
    """Placeholder rows are identified before normal filename generation.

    Only SME values ending with a period (NV., ACC., etc.) use shared placeholder filenames.
    No Cal Req alone does not trigger placeholder logic.
    """
    _ = settings
    system = _clean_cell(row.get("SME Generic System Name", ""))
    if system.endswith("."):
        code = _extract_feature_code(system)
        if code:
            return True, code
    return False, ""


def get_placeholder_filename(code: str, settings: AuditSettings | None = None) -> str:
    mapping = _get_placeholder_filenames(settings)
    return mapping.get(code.upper(), "")


def _get_model_path_variants(row: dict[str, str], settings: AuditSettings | None = None) -> list[str]:
    make = _clean_cell(row.get("Make", ""))
    raw_model = _clean_cell(row.get("Raw Model", row.get("Model", "")))
    normalized_model = _clean_cell(row.get("Normalized Model", raw_model))

    variants = []
    for model in {raw_model, normalized_model}:
        if model:
            variants.append(model)

    for chart_model, sop_model in _find_make_alias_map(make, settings).items():
        if raw_model == chart_model or normalized_model == sop_model:
            variants.extend([chart_model, sop_model])

    deduped: list[str] = []
    seen: set[str] = set()
    for model in variants:
        key = model.lower()
        if key not in seen:
            seen.add(key)
            deduped.append(model)
    return deduped


def _normalize_path_text(path: str) -> str:
    return path.replace("\\", "/").lower()


def _path_matches_folder(path: str, row: dict[str, str], settings: AuditSettings | None = None) -> bool:
    if not path:
        return False

    norm_path = _normalize_path_text(path)
    year = _clean_cell(row.get("Year", "")).lower()
    make = _clean_cell(row.get("Make", "")).lower()
    models = [model.lower() for model in _get_model_path_variants(row, settings)]

    if year and year not in norm_path:
        return False

    if make and make not in norm_path:
        return False

    return any(model and model in norm_path for model in models)


def normalize_model(make: str, raw_model: str, settings: AuditSettings | None = None) -> str:
    """Map Manufacturer Chart model names to SOP/OneDrive naming convention."""
    raw_model = _clean_cell(raw_model)
    if not raw_model:
        return raw_model

    model_map = _find_make_alias_map(make, settings)
    if raw_model in model_map:
        return model_map[raw_model]

    raw_lower = raw_model.lower()
    for chart_model, sop_model in model_map.items():
        if chart_model.strip().lower() == raw_lower:
            return sop_model

    return raw_model


def _apply_placeholder_mappings(row: dict[str, str], settings: AuditSettings | None = None) -> dict[str, str]:
    mapped = dict(row)
    if not settings or not settings.placeholder_mappings:
        return mapped
    for mapping in settings.placeholder_mappings:
        placeholder = str(mapping.get("placeholder", "")).strip()
        column = str(mapping.get("column", "")).strip()
        if placeholder and column and column in mapped:
            for key, value in list(mapped.items()):
                if isinstance(value, str) and placeholder in value:
                    mapped[key] = value.replace(placeholder, mapped[column])
    return mapped


def extract_system_root_from_row(row: dict[str, str]) -> str:
    if _clean_cell(row.get("Is Placeholder", "")).lower() == "yes":
        return _clean_cell(row.get("Placeholder Code", "")).upper()

    for field in ("SME Generic System Name", "Feature"):
        system = _clean_cell(row.get(field, "")).rstrip(".")
        if not system:
            continue
        normalized = normalize_system_component(system)
        token = re.match(r"^([A-Za-z]+)", normalized)
        if token:
            return token.group(1).upper()
    return _extract_feature_code(row.get("SME Generic System Name", ""), row.get("Feature", ""))


def extract_system_roots_from_filename(filename: str) -> set[str]:
    roots: set[str] = set()
    name = _clean_cell(filename)
    if not name:
        return roots

    for match in re.finditer(r"\[([A-Za-z]+)\]", name):
        roots.add(match.group(1).upper())

    stem = name[:-4] if name.lower().endswith(".pdf") else name
    last_open = stem.rfind("(")
    last_close = stem.rfind(")")
    if last_open != -1 and last_close > last_open:
        inner = stem[last_open + 1:last_close].strip()
        token = re.match(r"^([A-Za-z]+)", inner)
        if token:
            roots.add(token.group(1).upper())

    return roots


def _system_families(root: str) -> set[str]:
    root = root.upper()
    family = {root}
    family.update(SYSTEM_FAMILY_ALIASES.get(root, set()))
    for key, aliases in SYSTEM_FAMILY_ALIASES.items():
        if root in aliases:
            family.add(key)
            family.update(aliases)
    return family


def _filename_matches_system_root(filename: str, expected_root: str) -> bool:
    if not expected_root:
        return True
    file_roots = extract_system_roots_from_filename(filename)
    if not file_roots:
        return False
    expected_family = _system_families(expected_root)
    return bool(file_roots & expected_family)


def _filter_onedrive_by_system_root(
    onedrive_df: pd.DataFrame,
    expected_root: str,
) -> pd.DataFrame:
    if not expected_root:
        return onedrive_df
    mask = onedrive_df["Name"].apply(lambda name: _filename_matches_system_root(name, expected_root))
    return onedrive_df[mask].copy()


def _strip_split_suffix(normalized: str, settings: AuditSettings | None = None) -> str:
    result = normalized
    for pattern in _get_split_patterns(settings):
        result = re.sub(pattern, "", result, flags=re.IGNORECASE)
    result = re.sub(r"\s+", " ", result).strip()
    return result


def _is_sop_split_filename(filename: str) -> bool:
    return bool(SOP_SPLIT_PATTERN.search(filename))


def _is_non_sop_split_filename(filename: str, normalized: str, expected_norm: str) -> bool:
    if _is_sop_split_filename(filename):
        return False
    if NON_SOP_SPLIT_PATTERN.search(filename):
        return True
    if normalized == expected_norm:
        return False
    if normalized.startswith(expected_norm) or expected_norm in normalized:
        for pattern in _get_split_patterns():
            if re.search(pattern, normalized, flags=re.IGNORECASE):
                return True
    return False


def _is_split_candidate(filename: str, normalized: str, expected_norm: str) -> bool:
    if normalized == expected_norm:
        return False
    if not (normalized.startswith(expected_norm) or expected_norm in normalized):
        return False
    return _is_sop_split_filename(filename) or _is_non_sop_split_filename(
        filename, normalized, expected_norm
    )


def _token_set(text: str) -> set[str]:
    return {token for token in re.split(r"[\s()/_-]+", text.lower()) if token}


def _similarity_score(expected_norm: str, candidate_norm: str) -> float:
    exp_tokens = _token_set(expected_norm)
    cand_tokens = _token_set(candidate_norm)
    if not exp_tokens or not cand_tokens:
        return 0.0
    intersection = exp_tokens & cand_tokens
    union = exp_tokens | cand_tokens
    return len(intersection) / len(union)


def _find_manufacturer_chart_sheet(excel_file: BytesIO | str) -> tuple[str, pd.DataFrame]:
    workbook = pd.ExcelFile(excel_file)
    best_sheet = None
    best_df = None
    best_score = -1

    for sheet_name in workbook.sheet_names:
        df = pd.read_excel(workbook, sheet_name=sheet_name, dtype=str)
        if df.empty:
            continue
        score = 0
        normalized_headers = {_normalize_header(c) for c in df.columns}
        for canonical in MC_REQUIRED_COLUMNS:
            candidates = [_normalize_header(canonical)] + [
                _normalize_header(alias) for alias in MC_COLUMN_ALIASES.get(canonical, [])
            ]
            if any(candidate in normalized_headers for candidate in candidates):
                score += 1
        if score > best_score:
            best_score = score
            best_sheet = sheet_name
            best_df = df

    if best_df is None or best_score < len(MC_REQUIRED_COLUMNS):
        raise AuditValidationError(
            "Could not find a manufacturer chart sheet with required columns: "
            + ", ".join(MC_REQUIRED_COLUMNS)
        )
    return best_sheet, best_df


def detect_manufacturer(
    mc_filename: str | None,
    onedrive_filename: str | None,
    chart_df: pd.DataFrame,
    column_map: dict[str, str],
) -> str:
    """Infer manufacturer from filenames or dominant Make value in chart."""
    filename_candidates: list[str] = []
    for name in (mc_filename, onedrive_filename):
        if not name:
            continue
        stem = re.sub(r"\.[^.]+$", "", name)
        stem = re.sub(r"[_-]+", " ", stem)
        stem = re.sub(
            r"(?i)\b(manufacturer|component|chart|onedrive|export|si|library|audit|file)\b",
            "",
            stem,
        )
        stem = re.sub(r"\s+", " ", stem).strip()
        if stem:
            filename_candidates.append(stem)

    make_col = column_map["Make"]
    makes = [
        _clean_cell(value)
        for value in chart_df[make_col].dropna().tolist()
        if _clean_cell(value)
    ]
    if makes:
        dominant_make = Counter(makes).most_common(1)[0][0]
    else:
        dominant_make = ""

    if filename_candidates:
        for candidate in filename_candidates:
            if dominant_make and dominant_make.lower() in candidate.lower():
                return dominant_make
        first = filename_candidates[0]
        return first.title() if first.islower() else first

    if dominant_make:
        return dominant_make

    return "Unknown Manufacturer"


def build_expected_filename(
    row: dict[str, str],
    settings: AuditSettings | None = None,
    *,
    use_normalized_model: bool = True,
) -> tuple[str, bool]:
    mapped = _apply_placeholder_mappings(row, settings)

    is_placeholder, placeholder_code = detect_placeholder_row(mapped, settings)
    if is_placeholder:
        filename = get_placeholder_filename(placeholder_code, settings)
        if not filename:
            filename = f"No Placeholder Mapping [{placeholder_code}] - ({placeholder_code}) For This Vehicle.pdf"
        return filename, False

    year = _clean_cell(mapped.get("Year", ""))
    make = _clean_cell(mapped.get("Make", ""))
    if use_normalized_model and mapped.get("Normalized Model"):
        model = _clean_cell(mapped.get("Normalized Model", ""))
    else:
        model = _clean_cell(mapped.get("Raw Model", mapped.get("Model", "")))
    system = _clean_cell(mapped.get("SME Generic System Name", ""))

    if not system:
        feature = _clean_cell(mapped.get("Feature", ""))
        cal_type = _clean_cell(mapped.get("Calibration Type", ""))
        system = " - ".join(part for part in (feature, cal_type) if part)

    raw_system = system
    system = normalize_system_component(system)
    prefix = _collapse_spaces(f"{year} {make} {model}")
    filename = f"{prefix} ({system}).pdf"
    filename = _apply_translation_rules(filename, settings)
    sanitized, repaired = normalize_expected_filename(filename)
    system_normalized = _collapse_spaces(raw_system) != system
    return sanitized, repaired or system_normalized


def load_manufacturer_chart(
    file_bytes: BytesIO,
    filename: str | None = None,
    settings: AuditSettings | None = None,
) -> tuple[pd.DataFrame, str, dict[str, str]]:
    sheet_name, raw_df = _find_manufacturer_chart_sheet(file_bytes)
    column_map = _resolve_columns(raw_df, MC_REQUIRED_COLUMNS, MC_COLUMN_ALIASES)
    optional_mc_columns = {"SME Calibration Type": ["sme calibration type", "sme cal type"]}
    normalized_headers = {_normalize_header(col): col for col in raw_df.columns}
    for canonical, aliases in optional_mc_columns.items():
        candidates = [_normalize_header(canonical)] + [_normalize_header(alias) for alias in aliases]
        for candidate in candidates:
            if candidate in normalized_headers:
                column_map[canonical] = normalized_headers[candidate]
                break

    records = []
    for _, row in raw_df.iterrows():
        mapped = {canonical: _clean_cell(row[column_map[canonical]]) for canonical in MC_REQUIRED_COLUMNS}
        for canonical in optional_mc_columns:
            if canonical in column_map:
                mapped[canonical] = _clean_cell(row[column_map[canonical]])
        if not any(mapped.values()):
            continue
        if not mapped["Year"] or not mapped["Make"] or not mapped["Model"]:
            continue

        raw_model = mapped["Model"]
        normalized_model = normalize_model(mapped["Make"], raw_model, settings)
        mapped["Raw Model"] = raw_model
        mapped["Normalized Model"] = normalized_model
        is_placeholder, placeholder_code = detect_placeholder_row(mapped, settings)
        mapped["Is Placeholder"] = "Yes" if is_placeholder else "No"
        mapped["Placeholder Code"] = placeholder_code
        expected_filename, _ = build_expected_filename(mapped, settings)
        mapped["Expected Filename"] = expected_filename
        mapped["Expected Type"] = "Placeholder" if is_placeholder else "Model-Specific"
        mapped["Source Sheet"] = sheet_name
        records.append(mapped)

    if not records:
        raise AuditValidationError(
            f"Manufacturer chart sheet '{sheet_name}' has headers but no usable data rows."
        )

    expected_df = pd.DataFrame(records)
    manufacturer = detect_manufacturer(filename, None, expected_df, column_map)
    return expected_df, manufacturer, column_map


def load_onedrive_export(file_bytes: BytesIO) -> pd.DataFrame:
    workbook = pd.ExcelFile(file_bytes)
    best_df = None
    best_score = -1

    for sheet_name in workbook.sheet_names:
        df = pd.read_excel(workbook, sheet_name=sheet_name, dtype=str)
        if df.empty:
            continue
        try:
            column_map = _resolve_columns(
                df,
                ONEDRIVE_REQUIRED_COLUMNS,
                ONEDRIVE_COLUMN_ALIASES,
                optional=ONEDRIVE_OPTIONAL_COLUMNS,
            )
            score = len(column_map)
        except AuditValidationError:
            continue
        if score > best_score:
            best_score = score
            filtered = df.copy()
            item_col = column_map["Item Type"]
            name_col = column_map["Name"]
            filtered = filtered[filtered[item_col].astype(str).str.strip().str.lower() == "item"]
            filtered = filtered[filtered[name_col].astype(str).str.strip() != ""]
            rename_map = {name_col: "Name", item_col: "Item Type"}
            if "Path" in column_map:
                rename_map[column_map["Path"]] = "Path"
            filtered = filtered.rename(columns=rename_map)
            if "Path" not in filtered.columns:
                filtered["Path"] = ""
            filtered["Source Sheet"] = sheet_name
            best_df = filtered

    if best_df is None or best_df.empty:
        raise AuditValidationError(
            "OneDrive export must contain 'Name' and 'Item Type' columns with at least one Item row."
        )

    inventory = best_df.copy()
    inventory["Name"] = inventory["Name"].astype(str).str.strip()
    inventory["Path"] = inventory["Path"].astype(str).str.strip()
    inventory["Normalized Name"] = inventory["Name"].map(_normalize_filename)
    inventory["Normalized Path"] = inventory["Path"].map(_normalize_path_text)
    return inventory


def _model_normalization_note(raw_model: str, normalized_model: str) -> str:
    if raw_model != normalized_model:
        return f"Matched after model normalization: {raw_model} -> {normalized_model}"
    return "Exact normalized filename match."


def _build_filename_candidates(
    row: dict[str, str],
    settings: AuditSettings | None = None,
) -> list[tuple[str, str | None]]:
    """Return expected filename candidates and optional normalization notes."""
    if _clean_cell(row.get("Is Placeholder", "")).lower() == "yes":
        code = _clean_cell(row.get("Placeholder Code", ""))
        filename = get_placeholder_filename(code, settings) or _clean_cell(row.get("Expected Filename", ""))
        return [(filename, _placeholder_generated_note(row))]

    raw_model = _clean_cell(row.get("Raw Model", row.get("Model", "")))
    normalized_model = _clean_cell(row.get("Normalized Model", raw_model))
    candidates: list[tuple[str, str | None]] = []
    seen: set[str] = set()

    def add_candidate(filename: str, note: str | None) -> None:
        sanitized, repaired = normalize_expected_filename(filename)
        final_note = _append_match_notes(note, FILENAME_REPAIR_NOTE if repaired else None)
        if sanitized and sanitized not in seen:
            seen.add(sanitized)
            candidates.append((sanitized, final_note))

    primary_filename, primary_repaired = build_expected_filename(row, settings, use_normalized_model=True)
    add_candidate(
        primary_filename,
        _append_match_notes(
            _model_normalization_note(raw_model, normalized_model)
            if raw_model != normalized_model
            else None,
            FILENAME_REPAIR_NOTE if primary_repaired else None,
        ),
    )

    if raw_model != normalized_model:
        raw_row = {**row, "Normalized Model": raw_model}
        raw_filename, raw_repaired = build_expected_filename(raw_row, settings, use_normalized_model=True)
        add_candidate(
            raw_filename,
            _append_match_notes(
                f"Tried raw Manufacturer Chart model: {raw_model}",
                FILENAME_REPAIR_NOTE if raw_repaired else None,
            ),
        )

    make = _clean_cell(row.get("Make", ""))
    for chart_model, sop_model in _find_make_alias_map(make, settings).items():
        if chart_model == raw_model and sop_model == normalized_model:
            continue
        alias_row = {**row, "Normalized Model": sop_model}
        alias_filename, alias_repaired = build_expected_filename(
            alias_row,
            settings,
            use_normalized_model=True,
        )
        add_candidate(
            alias_filename,
            _append_match_notes(
                f"Matched after model normalization: {chart_model} -> {sop_model}",
                FILENAME_REPAIR_NOTE if alias_repaired else None,
            ),
        )

    return candidates


def _match_single_expected_filename(
    expected_filename: str,
    onedrive_names: list[str],
    onedrive_normalized: list[str],
    settings: AuditSettings | None = None,
) -> tuple[str, str, str] | None:
    _ = settings
    sanitized, repaired = normalize_expected_filename(expected_filename)
    expected_norm = _normalize_filename(sanitized)
    exact_lookup: dict[str, list[str]] = {}
    for norm, name in zip(onedrive_normalized, onedrive_names):
        exact_lookup.setdefault(norm, []).append(name)

    if expected_norm in exact_lookup:
        actual = "; ".join(sorted(set(exact_lookup[expected_norm])))
        note = FILENAME_REPAIR_NOTE if repaired else "Exact normalized filename match."
        return MATCH_EXACT, actual, note

    sop_matches: list[str] = []
    non_sop_matches: list[str] = []
    for actual_name, actual_norm in zip(onedrive_names, onedrive_normalized):
        if not _is_split_candidate(actual_name, actual_norm, expected_norm):
            continue
        if _is_sop_split_filename(actual_name):
            sop_matches.append(actual_name)
        else:
            non_sop_matches.append(actual_name)

    if sop_matches:
        all_names = "; ".join(sorted(set(sop_matches)))
        return MATCH_SPLIT_PRESENT, all_names, "Split file found using SOP -Part-# naming."

    if non_sop_matches:
        all_names = "; ".join(sorted(set(non_sop_matches)))
        return MATCH_SPLIT_NAMING, all_names, "Split file found but naming differs from SOP."

    return None


def _placeholder_source_label(row: dict[str, str]) -> str:
    system = _clean_cell(row.get("SME Generic System Name", ""))
    if system.endswith("."):
        return system
    code = _clean_cell(row.get("Placeholder Code", ""))
    return code or system or "placeholder"


def _placeholder_generated_note(row: dict[str, str]) -> str:
    label = _placeholder_source_label(row)
    if label.endswith("."):
        return f"Placeholder generated from {label}"
    return f"Placeholder generated from {label}."


def _match_placeholder_to_onedrive(
    row: dict[str, str],
    onedrive_df: pd.DataFrame,
    settings: AuditSettings | None = None,
) -> tuple[str, str, str]:
    code = _clean_cell(row.get("Placeholder Code", ""))
    expected_filename = get_placeholder_filename(code, settings) or _clean_cell(row.get("Expected Filename", ""))
    expected_norm = _normalize_filename(expected_filename)
    generated_note = _placeholder_generated_note(row)

    system_df = _filter_onedrive_by_system_root(onedrive_df, code)
    matches = system_df[system_df["Normalized Name"] == expected_norm]
    if matches.empty:
        return (
            MATCH_MISSING,
            "",
            _append_match_notes(generated_note, "No matching placeholder found in OneDrive export"),
        )

    has_path = "Path" in onedrive_df.columns and onedrive_df["Path"].astype(str).str.strip().ne("").any()
    if has_path:
        folder_matches = matches[matches["Path"].apply(lambda path: _path_matches_folder(path, row, settings))]
        if not folder_matches.empty:
            actual_names = "; ".join(sorted(folder_matches["Name"].unique()))
            return (
                MATCH_EXACT,
                actual_names,
                _append_match_notes(generated_note, "Placeholder exact filename match."),
            )

        global_names = "; ".join(sorted(matches["Name"].unique()))
        return (
            MATCH_MISSING,
            global_names,
            _append_match_notes(generated_note, "Placeholder file exists globally but not in matching folder"),
        )

    actual_names = "; ".join(sorted(matches["Name"].unique()))
    return (
        MATCH_EXACT,
        actual_names,
        _append_match_notes(generated_note, "Placeholder exact filename match."),
    )


def _match_expected_to_onedrive(
    row: dict[str, str],
    onedrive_df: pd.DataFrame,
    settings: AuditSettings | None = None,
) -> tuple[str, str, str]:
    if _clean_cell(row.get("Is Placeholder", "")).lower() == "yes":
        return _match_placeholder_to_onedrive(row, onedrive_df, settings)

    system_root = extract_system_root_from_row(row)
    system_df = _filter_onedrive_by_system_root(onedrive_df, system_root)
    onedrive_names = system_df["Name"].tolist()
    onedrive_normalized = system_df["Normalized Name"].tolist()
    candidates = _build_filename_candidates(row, settings)
    primary_filename = candidates[0][0]
    primary_norm = _normalize_filename(primary_filename)

    for expected_filename, normalization_note in candidates:
        result = _match_single_expected_filename(
            expected_filename,
            onedrive_names,
            onedrive_normalized,
            settings,
        )
        if result is None:
            continue

        status, actual_name, default_note = result
        if normalization_note and status in {MATCH_EXACT, MATCH_SPLIT_PRESENT, MATCH_SPLIT_NAMING}:
            return status, actual_name, _append_match_notes(normalization_note, default_note)
        return status, actual_name, default_note

    ignored_vehicle_match = ""
    best_name = ""
    best_score = 0.0
    for actual_name, actual_norm in zip(onedrive_df["Name"], onedrive_df["Normalized Name"]):
        if not _filename_matches_system_root(actual_name, system_root):
            vehicle_tokens = {
                token
                for token in _token_set(primary_norm)
                if token.isdigit() or len(token) > 2
            }
            candidate_tokens = _token_set(actual_norm)
            if vehicle_tokens and len(vehicle_tokens & candidate_tokens) >= max(2, len(vehicle_tokens) // 2):
                ignored_vehicle_match = actual_name
            continue

        score = _similarity_score(primary_norm, actual_norm)
        if score > best_score:
            best_score = score
            best_name = actual_name

    similarity_threshold = settings.similarity_threshold if settings else 0.55
    if best_score >= similarity_threshold:
        return (
            MATCH_POTENTIAL_MISMATCH,
            best_name,
            f"Closest same-system filename similarity {best_score:.0%}; classification or naming may differ.",
        )

    if ignored_vehicle_match:
        return (
            MATCH_MISSING,
            "",
            _append_match_notes(
                "No same-system candidate found.",
                f"Same vehicle found but different system ignored: {ignored_vehicle_match}",
            ),
        )

    return MATCH_MISSING, "", "No same-system candidate found."


def run_matching(
    expected_df: pd.DataFrame,
    onedrive_df: pd.DataFrame,
    settings: AuditSettings | None = None,
) -> pd.DataFrame:
    audit_rows = []
    for _, row in expected_df.iterrows():
        status, actual_name, notes = _match_expected_to_onedrive(
            row.to_dict(),
            onedrive_df,
            settings,
        )
        audit_rows.append(
            {
                "Year": row["Year"],
                "Make": row["Make"],
                "Raw Model": row["Raw Model"],
                "Normalized Model": row["Normalized Model"],
                "Feature": row["Feature"],
                "Calibration Type": row["Calibration Type"],
                "SME Generic System Name": row["SME Generic System Name"],
                "Tertiary Key": row["Tertiary Key"],
                "Is Placeholder": row.get("Is Placeholder", "No"),
                "Placeholder Code": row.get("Placeholder Code", ""),
                "Expected Type": row.get("Expected Type", "Model-Specific"),
                "Expected Filename": row["Expected Filename"],
                "Actual Filename(s)": actual_name,
                "Match Status": status,
                "Issue Owner": ISSUE_OWNER_MAP[status],
                "Match Notes": notes,
            }
        )

    return pd.DataFrame(audit_rows)


def _top_missing_clusters(missing_df: pd.DataFrame, limit: int = 10) -> pd.DataFrame:
    if missing_df.empty:
        return pd.DataFrame(columns=["Cluster", "Missing Count"])

    grouped = (
        missing_df.groupby(["Make", "Raw Model", "Feature"], dropna=False)
        .size()
        .reset_index(name="Missing Count")
        .sort_values("Missing Count", ascending=False)
        .head(limit)
    )
    grouped["Cluster"] = grouped.apply(
        lambda r: f"{r['Make']} {r['Raw Model']} - {r['Feature']}".strip(" -"),
        axis=1,
    )
    return grouped[["Cluster", "Missing Count"]]


def build_dashboard_metrics(audit_df: pd.DataFrame) -> dict[str, Any]:
    total_expected = len(audit_df)
    exact_matches = int((audit_df["Match Status"] == MATCH_EXACT).sum())
    split_present = int((audit_df["Match Status"] == MATCH_SPLIT_PRESENT).sum())
    passing = int(audit_df["Match Status"].isin(PASSING_STATUSES).sum())
    needs_review = int(audit_df["Issue Owner"].isin(
        [
            "Compliant / PCS Review",
            "SI Naming Review",
            "Needs Human Review",
            "SI / Export Gap Review",
        ]
    ).sum())
    compliance_rate = round((passing / total_expected) * 100, 1) if total_expected else 0.0

    status_breakdown = (
        audit_df["Match Status"]
        .value_counts()
        .rename_axis("Status")
        .reset_index(name="Count")
    )

    missing_df = audit_df[audit_df["Match Status"] == MATCH_MISSING]
    top_clusters = _top_missing_clusters(missing_df)

    return {
        "Expected MC Deliverables": total_expected,
        "Exact Filename Matches": exact_matches,
        "Split Files Present": split_present,
        "Passing Compliance": passing,
        "Needs SI/PCS Review": needs_review,
        "Compliance Rate (%)": compliance_rate,
        "Status Breakdown": status_breakdown,
        "Top Missing Clusters": top_clusters,
    }


def get_method_notes(settings: AuditSettings | None = None) -> list[str]:
    split_patterns = _get_split_patterns(settings)
    similarity_threshold = settings.similarity_threshold if settings else 0.55
    return [
        "Expected filenames are built from the Manufacturer Component Chart using SOP format:",
        "YEAR MAKE MODEL (SME GENERIC SYSTEM NAME).pdf",
        "Example: 2024 Buick Enclave (ACC 2).pdf",
        "Example normalization: 1500 Silverado -> Silverado 1500 for Chevrolet.",
        "System normalization examples: ACC (2), ACC(2), ACC 2) -> ACC 2.",
        "",
        "Model aliases are applied before expected filename generation and used as fallback match candidates.",
        "Expected filenames are syntax-validated before matching (duplicate spaces/parentheses, .pdf.pdf).",
        "",
        "Placeholder rows are detected only when SME Generic System Name ends with a period (NV., ACC., etc.).",
        "No Cal Req alone does not trigger placeholder logic.",
        "Placeholder matching uses OneDrive Path to confirm Year/Model folder placement when available.",
        "Closest-match logic is system-root aware and does not compare unrelated systems.",
        "Split files are evaluated before potential classification mismatch.",
        "",
        "OneDrive inventory is sourced from rows where Item Type = Item, using the Name column.",
        "",
        "Match logic (evaluated in order):",
        f"1. {MATCH_EXACT} -> Issue Owner: {ISSUE_OWNER_MAP[MATCH_EXACT]}",
        f"2. {MATCH_SPLIT_PRESENT} -> Issue Owner: {ISSUE_OWNER_MAP[MATCH_SPLIT_PRESENT]}",
        f"3. {MATCH_SPLIT_NAMING} -> Issue Owner: {ISSUE_OWNER_MAP[MATCH_SPLIT_NAMING]}",
        f"4. {MATCH_POTENTIAL_MISMATCH} -> Issue Owner: {ISSUE_OWNER_MAP[MATCH_POTENTIAL_MISMATCH]}",
        f"5. {MATCH_MISSING} -> Issue Owner: {ISSUE_OWNER_MAP[MATCH_MISSING]}",
        "",
        "Split file detection looks for Part/Pt/Split/Section markers or numbered suffix patterns.",
        f"Active split patterns: {len(split_patterns)}",
        f"Potential mismatches use token similarity scoring (threshold: {similarity_threshold:.0%}).",
    ]


def run_audit(
    mc_bytes: BytesIO,
    onedrive_bytes: BytesIO,
    mc_filename: str | None = None,
    onedrive_filename: str | None = None,
    settings: AuditSettings | None = None,
) -> AuditResult:
    expected_df, _, _ = load_manufacturer_chart(mc_bytes, mc_filename, settings)
    onedrive_df = load_onedrive_export(onedrive_bytes)
    manufacturer = detect_manufacturer(
        mc_filename,
        onedrive_filename,
        expected_df,
        {"Make": "Make"},
    )

    audit_df = run_matching(expected_df, onedrive_df, settings)
    dashboard = build_dashboard_metrics(audit_df)

    from .benchmark import validate_acura_benchmark

    benchmark_result = validate_acura_benchmark(dashboard, manufacturer)
    if benchmark_result:
        dashboard["Benchmark Validation"] = benchmark_result

    return AuditResult(
        manufacturer=manufacturer,
        expected_df=expected_df,
        onedrive_df=onedrive_df,
        audit_df=audit_df,
        dashboard=dashboard,
        method_notes=get_method_notes(settings),
    )
