"""Portable SI Library audit execution — no SQLite, no filesystem side effects."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from io import BytesIO
from typing import Any

from protech_validation_engine.si_library.audit_engine import AuditResult, run_audit
from protech_validation_engine.si_library.config import AuditSettings
from protech_validation_engine.si_library.executive_intelligence import (
    ExecutivePackage,
    build_executive_package,
)
from protech_validation_engine.si_library.excel_writer import (
    build_output_filename,
    write_audit_workbook,
)
from protech_validation_engine.si_library.pdf_writer import PDF_FILENAME, write_executive_pdf

ENGINE_ID = "si_library_audit"

MATCH_SEVERITY: dict[str, str] = {
    "Missing From OneDrive Export": "high",
    "Potential Classification/Naming Mismatch": "medium",
    "Split File Naming Difference": "medium",
    "Split File Present": "low",
    "Exact Match": "info",
}

MATCH_ROOT_CAUSE: dict[str, str] = {
    "Missing From OneDrive Export": "library_issue",
    "Potential Classification/Naming Mismatch": "rule_mismatch",
    "Split File Naming Difference": "rule_mismatch",
    "Split File Present": "rule_mismatch",
    "Exact Match": "unknown",
}


@dataclass
class AuditRunOutput:
    result: AuditResult
    executive: ExecutivePackage
    workbook_bytes: bytes
    pdf_bytes: bytes
    output_name: str
    pdf_filename: str = PDF_FILENAME


def execute_audit(
    mc_bytes: bytes,
    onedrive_bytes: bytes,
    *,
    mc_filename: str,
    onedrive_filename: str,
    settings: AuditSettings,
) -> AuditRunOutput:
    """Run SI Library audit and return artifacts without persisting to SQLite."""
    result = run_audit(
        mc_bytes=BytesIO(mc_bytes),
        onedrive_bytes=BytesIO(onedrive_bytes),
        mc_filename=mc_filename,
        onedrive_filename=onedrive_filename,
        settings=settings,
    )
    executive = build_executive_package(result)

    def _build_workbook():
        try:
            return write_audit_workbook(result, settings, executive)
        except TypeError:
            return write_audit_workbook(result, settings)

    with ThreadPoolExecutor(max_workers=2) as pool:
        workbook_future = pool.submit(_build_workbook)
        pdf_future = pool.submit(write_executive_pdf, executive)
        workbook_bytes = workbook_future.result()
        pdf_bytes = pdf_future.result()

    output_name = build_output_filename(result.manufacturer)
    return AuditRunOutput(
        result=result,
        executive=executive,
        workbook_bytes=workbook_bytes.getvalue(),
        pdf_bytes=pdf_bytes.getvalue(),
        output_name=output_name,
    )


def _json_safe_dashboard(dashboard: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    for key, value in dashboard.items():
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[key] = value
        elif hasattr(value, "to_dict"):
            continue
        else:
            safe[key] = str(value)
    return safe


def build_run_summary(output: AuditRunOutput) -> dict[str, Any]:
    """Normalized run summary for Flow ingestion (Phase 2 contract)."""
    dashboard = output.result.dashboard
    return {
        "engine_id": ENGINE_ID,
        "manufacturer": output.result.manufacturer,
        "compliance_rate": dashboard.get("Compliance Rate (%)"),
        "expected_deliverables": dashboard.get("Expected MC Deliverables"),
        "passing_compliance": dashboard.get("Passing Compliance"),
        "needs_review": dashboard.get("Needs SI/PCS Review"),
        "output_name": output.output_name,
        "executive_summary": output.executive.executive_summary,
        "dashboard": _json_safe_dashboard(dict(dashboard)),
    }


def normalize_findings(output: AuditRunOutput) -> list[dict[str, Any]]:
    """Map enriched audit rows to Flow finding shape (Phase 3 contract)."""
    df = output.executive.enriched_audit_df
    if df is None or df.empty:
        return []

    findings: list[dict[str, Any]] = []
    status_col = "Match Status" if "Match Status" in df.columns else None
    if not status_col:
        return findings

    for idx, row in df.iterrows():
        match_status = str(row.get(status_col, ""))
        if match_status in ("Exact Match",):
            continue

        title_parts = [output.result.manufacturer]
        for col in ("Year", "Model", "Feature"):
            if col in df.columns and row.get(col):
                title_parts.append(str(row[col]))
        title = " · ".join(title_parts) if len(title_parts) > 1 else f"{match_status} finding"

        confidence = int(row.get("Confidence Score", 0) or 0) if "Confidence Score" in df.columns else 0
        findings.append(
            {
                "engine_id": ENGINE_ID,
                "title": title,
                "severity": MATCH_SEVERITY.get(match_status, "medium"),
                "root_cause": MATCH_ROOT_CAUSE.get(match_status, "needs_investigation"),
                "manufacturer": output.result.manufacturer,
                "match_status": match_status,
                "confidence_score": confidence,
                "suggested_correction": str(row.get("Match Notes", "") or ""),
                "affected_record_ref": {
                    k: row.get(k)
                    for k in ("Year", "Model", "Feature", "SME Generic System Name")
                    if k in df.columns and row.get(k) is not None
                },
                "evidence": {"row_index": int(idx), "match_status": match_status},
            }
        )
    return findings


def build_job_result(output: AuditRunOutput) -> dict[str, Any]:
    """Full worker → Flow payload for completed jobs."""
    return {
        "status": "completed",
        "run_summary": build_run_summary(output),
        "findings": normalize_findings(output),
        "artifacts": [
            {"role": "output_workbook", "filename": output.output_name},
            {"role": "output_pdf", "filename": output.pdf_filename},
        ],
    }


def audit_settings_to_dict(settings: AuditSettings) -> dict[str, Any]:
    return asdict(settings)
