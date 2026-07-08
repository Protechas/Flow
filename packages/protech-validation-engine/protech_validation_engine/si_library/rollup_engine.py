"""Aggregate metrics from completed SI Library audit workbooks."""

from __future__ import annotations

import re
from dataclasses import dataclass
from io import BytesIO
from typing import Any

import pandas as pd

DASHBOARD_SHEET = "Dashboard"
AUDIT_RESULTS_SHEET = "Audit Results"
MASTER_REPORT_FILENAME = "Master_SI_Library_Compliance_Report.xlsx"

SUMMARY_COLUMNS = [
    "Manufacturer",
    "Expected",
    "Passing",
    "Review",
    "Missing",
    "Compliance",
]

DASHBOARD_METRIC_LABELS = [
    "Expected MC Deliverables",
    "Exact Filename Matches",
    "Split Files Present",
    "Passing Compliance",
    "Needs SI/PCS Review",
    "Compliance Rate (%)",
]


class RollupValidationError(Exception):
    """Raised when an uploaded workbook cannot be aggregated."""


@dataclass
class WorkbookImportDiagnostic:
    filename: str
    status: str
    manufacturer: str | None = None
    expected: int | None = None
    passing: int | None = None
    review: int | None = None
    compliance: float | None = None
    error: str | None = None


@dataclass
class MasterRollupResult:
    manufacturer_summary: pd.DataFrame
    status_breakdown: pd.DataFrame
    top_needs_review: pd.DataFrame
    top_lowest_compliance: pd.DataFrame
    highest_compliance: pd.DataFrame
    lowest_compliance: pd.DataFrame
    highest_missing: pd.DataFrame
    source_files: list[str]
    errors: list[str]
    import_diagnostics: pd.DataFrame | None = None


def _manufacturer_from_filename(filename: str) -> str:
    stem = re.sub(r"\.[^.]+$", "", filename)
    stem = re.sub(r"_SI_Library_Audit$", "", stem, flags=re.IGNORECASE)
    stem = stem.replace("_", " ").strip()
    return stem or "Unknown Manufacturer"


def _parse_dashboard_sheet(dashboard_df: pd.DataFrame, filename: str) -> tuple[str, dict[str, Any]]:
    manufacturer = _manufacturer_from_filename(filename)

    if dashboard_df.shape[0] >= 2 and pd.notna(dashboard_df.iloc[1, 0]):
        cell = str(dashboard_df.iloc[1, 0]).strip()
        if cell.lower().startswith("manufacturer:"):
            manufacturer = cell.split(":", 1)[1].strip() or manufacturer

    metrics: dict[str, Any] = {}
    for _, row in dashboard_df.iterrows():
        label = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
        if label in DASHBOARD_METRIC_LABELS:
            value = row.iloc[1] if len(row) > 1 else None
            metrics[label] = value

    missing = [label for label in DASHBOARD_METRIC_LABELS if label not in metrics]
    if missing:
        raise RollupValidationError(
            f"'{filename}' Dashboard sheet is missing metric(s): {', '.join(missing)}"
        )

    return manufacturer, metrics


def _parse_status_breakdown_from_dashboard(dashboard_df: pd.DataFrame) -> pd.DataFrame | None:
    status_row_idx = None
    for idx, row in dashboard_df.iterrows():
        if str(row.iloc[0]).strip().lower() == "status breakdown":
            status_row_idx = idx
            break

    if status_row_idx is None:
        return None

    header_row = status_row_idx + 1
    data_start = status_row_idx + 2
    if data_start >= len(dashboard_df):
        return None

    headers = [
        str(dashboard_df.iloc[header_row, col]).strip()
        for col in range(dashboard_df.shape[1])
        if pd.notna(dashboard_df.iloc[header_row, col])
    ]
    if len(headers) < 2:
        return None

    records = []
    for idx in range(data_start, len(dashboard_df)):
        row = dashboard_df.iloc[idx]
        if pd.isna(row.iloc[0]) or str(row.iloc[0]).strip() == "":
            break
        records.append({headers[0]: row.iloc[0], headers[1]: row.iloc[1]})

    if not records:
        return None

    return pd.DataFrame(records)


def _status_breakdown_from_audit_results(audit_df: pd.DataFrame, manufacturer: str) -> pd.DataFrame:
    if "Match Status" not in audit_df.columns:
        raise RollupValidationError("Audit Results sheet is missing 'Match Status' column.")

    counts = (
        audit_df["Match Status"]
        .value_counts()
        .rename_axis("Status")
        .reset_index(name="Count")
    )
    counts["Manufacturer"] = manufacturer
    return counts[["Manufacturer", "Status", "Count"]]


def _load_workbook(file_bytes: bytes, filename: str) -> tuple[str, dict[str, Any], pd.DataFrame]:
    workbook = pd.ExcelFile(BytesIO(file_bytes))
    if DASHBOARD_SHEET not in workbook.sheet_names:
        raise RollupValidationError(f"'{filename}' is missing a '{DASHBOARD_SHEET}' sheet.")

    dashboard_df = pd.read_excel(workbook, sheet_name=DASHBOARD_SHEET, header=None)
    manufacturer, metrics = _parse_dashboard_sheet(dashboard_df, filename)

    if AUDIT_RESULTS_SHEET in workbook.sheet_names:
        audit_df = pd.read_excel(workbook, sheet_name=AUDIT_RESULTS_SHEET, dtype=str)
        status_df = _status_breakdown_from_audit_results(audit_df, manufacturer)
    else:
        dashboard_status = _parse_status_breakdown_from_dashboard(dashboard_df)
        if dashboard_status is None:
            raise RollupValidationError(
                f"'{filename}' is missing '{AUDIT_RESULTS_SHEET}' and Dashboard status breakdown."
            )
        status_col = dashboard_status.columns[0]
        count_col = dashboard_status.columns[1]
        status_df = dashboard_status.rename(columns={status_col: "Status", count_col: "Count"})
        status_df["Manufacturer"] = manufacturer
        status_df = status_df[["Manufacturer", "Status", "Count"]]

    return manufacturer, metrics, status_df


def build_manufacturer_summary_row(
    manufacturer: str,
    metrics: dict[str, Any],
    status_df: pd.DataFrame,
) -> dict[str, Any]:
    missing = 0
    if "Status" in status_df.columns and "Count" in status_df.columns:
        missing_rows = status_df[status_df["Status"] == "Missing From OneDrive Export"]
        if not missing_rows.empty:
            missing = int(missing_rows["Count"].sum())

    return {
        "Manufacturer": manufacturer,
        "Expected": metrics["Expected MC Deliverables"],
        "Passing": metrics["Passing Compliance"],
        "Review": metrics["Needs SI/PCS Review"],
        "Missing": missing,
        "Compliance": metrics["Compliance Rate (%)"],
    }


def _diagnostics_to_dataframe(diagnostics: list[WorkbookImportDiagnostic]) -> pd.DataFrame:
    return pd.DataFrame(
        [
            {
                "Filename": item.filename,
                "Import Status": item.status,
                "Detected Manufacturer": item.manufacturer or "",
                "Expected": item.expected,
                "Passing": item.passing,
                "Review": item.review,
                "Compliance": item.compliance,
                "Error": item.error or "",
            }
            for item in diagnostics
        ]
    )


def run_master_rollup(uploaded_files: list[tuple[str, bytes]]) -> MasterRollupResult:
    """Aggregate one or more completed audit workbooks into a master rollup."""
    if not uploaded_files:
        raise RollupValidationError("Upload at least one completed audit workbook.")

    summary_rows: list[dict[str, Any]] = []
    status_frames: list[pd.DataFrame] = []
    source_files: list[str] = []
    errors: list[str] = []
    diagnostics: list[WorkbookImportDiagnostic] = []

    for filename, file_bytes in uploaded_files:
        try:
            manufacturer, metrics, status_df = _load_workbook(file_bytes, filename)
            summary_row = build_manufacturer_summary_row(manufacturer, metrics, status_df)
            summary_rows.append(summary_row)
            status_frames.append(status_df)
            source_files.append(filename)
            diagnostics.append(
                WorkbookImportDiagnostic(
                    filename=filename,
                    status="Success",
                    manufacturer=manufacturer,
                    expected=int(summary_row["Expected"]),
                    passing=int(summary_row["Passing"]),
                    review=int(summary_row["Review"]),
                    compliance=float(summary_row["Compliance"]),
                )
            )
        except RollupValidationError as exc:
            message = str(exc)
            errors.append(f"{filename}: {message}")
            diagnostics.append(
                WorkbookImportDiagnostic(
                    filename=filename,
                    status="Failed",
                    error=message,
                )
            )
        except Exception as exc:
            message = f"Unexpected error: {exc}"
            errors.append(f"{filename}: {message}")
            diagnostics.append(
                WorkbookImportDiagnostic(
                    filename=filename,
                    status="Failed",
                    error=message,
                )
            )

    if not summary_rows:
        raise RollupValidationError(
            "No workbooks could be aggregated. " + " ".join(errors)
        )

    manufacturer_summary = pd.DataFrame(summary_rows, columns=SUMMARY_COLUMNS)
    manufacturer_summary["Compliance"] = pd.to_numeric(
        manufacturer_summary["Compliance"],
        errors="coerce",
    )
    manufacturer_summary["Review"] = pd.to_numeric(manufacturer_summary["Review"], errors="coerce")
    manufacturer_summary["Missing"] = pd.to_numeric(manufacturer_summary["Missing"], errors="coerce")

    combined_status = pd.concat(status_frames, ignore_index=True)
    status_breakdown = (
        combined_status.groupby("Status", dropna=False)["Count"]
        .sum()
        .reset_index()
        .sort_values("Count", ascending=False)
        .rename(columns={"Count": "Total Count"})
    )

    top_needs_review = (
        manufacturer_summary.sort_values("Review", ascending=False)
        .head(10)
        .reset_index(drop=True)
    )

    top_lowest_compliance = (
        manufacturer_summary.sort_values("Compliance", ascending=True)
        .head(10)
        .reset_index(drop=True)
    )

    highest_compliance = manufacturer_summary.sort_values("Compliance", ascending=False).reset_index(drop=True)
    lowest_compliance = manufacturer_summary.sort_values("Compliance", ascending=True).reset_index(drop=True)
    highest_missing = manufacturer_summary.sort_values("Missing", ascending=False).reset_index(drop=True)

    return MasterRollupResult(
        manufacturer_summary=manufacturer_summary,
        status_breakdown=status_breakdown,
        top_needs_review=top_needs_review,
        top_lowest_compliance=top_lowest_compliance,
        highest_compliance=highest_compliance,
        lowest_compliance=lowest_compliance,
        highest_missing=highest_missing,
        source_files=source_files,
        errors=errors,
        import_diagnostics=_diagnostics_to_dataframe(diagnostics),
    )
