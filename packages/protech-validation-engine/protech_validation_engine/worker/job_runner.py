"""Process a validation job from stdin JSON, emit result JSON on stdout."""

from __future__ import annotations

import base64
import json
import sys
from dataclasses import asdict
from typing import Any

from protech_validation_engine.runner import build_job_result, execute_audit
from protech_validation_engine.si_library.config import AuditSettings

SEVERITY_BY_CLASSIFICATION = {
    "True Missing From Library": "high",
    "PCS / Mapping Review Candidate": "medium",
    "Naming Review Required": "medium",
    "Classification Review Required": "medium",
    "No Matching Expected Record": "low",
    "Manual Review Required": "low",
}


def _run_si_library_audit(payload: dict[str, Any]) -> dict[str, Any]:
    settings_raw = payload.get("settings_snapshot") or {}
    settings = AuditSettings.from_dict(settings_raw if isinstance(settings_raw, dict) else {})

    mc_bytes = base64.b64decode(payload["mc_bytes_b64"])
    export_bytes = base64.b64decode(payload["export_bytes_b64"])

    output = execute_audit(
        mc_bytes,
        export_bytes,
        mc_filename=str(payload.get("mc_filename") or "manufacturer_chart.xlsx"),
        onedrive_filename=str(payload.get("export_filename") or "onedrive_export.xlsx"),
        settings=settings,
    )

    result = build_job_result(output)
    result["workbook_b64"] = base64.b64encode(output.workbook_bytes).decode("ascii")
    result["pdf_b64"] = base64.b64encode(output.pdf_bytes).decode("ascii")
    result["workbook_filename"] = output.output_name
    result["pdf_filename"] = output.pdf_filename
    return result


def _library_validation_findings(detailed) -> list[dict[str, Any]]:
    """Map non-compliant validation rows to Flow's finding shape."""
    findings: list[dict[str, Any]] = []
    if detailed is None or detailed.empty:
        return findings
    for _, row in detailed.iterrows():
        classification = str(row.get("Validation Classification") or "")
        if classification == "Library File Exists":
            continue
        vehicle = " ".join(
            str(row.get(col) or "").strip() for col in ("Year", "Make", "Model")
        ).strip()
        system = str(row.get("System") or "").strip()
        findings.append(
            {
                "title": f"{classification}: {vehicle} {system}".strip(),
                "severity": SEVERITY_BY_CLASSIFICATION.get(classification, "low"),
                "root_cause": classification,
                "confidence_score": int(float(row.get("Confidence") or 0)),
                "suggested_correction": str(row.get("Evidence / Match Notes") or ""),
                "manufacturer": str(row.get("Make") or "") or None,
                "match_status": str(row.get("Matched Audit Status") or "") or None,
                "affected_record_ref": {
                    "year": str(row.get("Year") or ""),
                    "make": str(row.get("Make") or ""),
                    "model": str(row.get("Model") or ""),
                    "system": system,
                    "vin": str(row.get("VIN") or ""),
                    "repair_order": str(row.get("Repair Order") or ""),
                    "source_row": str(row.get("Source Row") or ""),
                },
                "evidence": {
                    "expected_filename": str(row.get("Expected Filename") or ""),
                    "actual_filename": str(row.get("Actual / Closest Filename") or ""),
                    "notes": str(row.get("Evidence / Match Notes") or ""),
                },
            }
        )
    return findings


def _run_library_validation(payload: dict[str, Any]) -> dict[str, Any]:
    from protech_validation_engine.si_library.library_validation import (
        build_audit_database,
        validate_external_report,
    )
    from protech_validation_engine.si_library.library_validation_export import (
        write_library_validation_workbook,
    )

    export_bytes = base64.b64decode(payload["export_bytes_b64"])
    filename = str(payload.get("export_filename") or "library_report.xlsx")

    audits = [
        {
            "manufacturer": str(a.get("manufacturer") or ""),
            "workbook_bytes": base64.b64decode(a["workbook_b64"]),
        }
        for a in payload.get("audits") or []
    ]
    audit_db = build_audit_database(audits)
    if audit_db.empty:
        return {
            "status": "failed",
            "error": "No audited library data available — complete at least one SI Library Audit first.",
        }

    result = validate_external_report(export_bytes, filename, audit_db)
    summary = result.summary

    validated = summary.records_validated or 0
    # appear_compliant mirrors library_file_exists in the engine's summary —
    # count it once or a 50% result reads as 100%.
    compliant = summary.library_file_exists
    compliance_rate = round((compliant / validated) * 100, 1) if validated else None

    workbook = write_library_validation_workbook(result)

    summary_dict = {
        k: v for k, v in asdict(summary).items() if not hasattr(v, "to_dict")
    }
    return {
        "status": "completed",
        "run_summary": {
            "engine_id": "si_library_external",
            "manufacturer": None,
            "compliance_rate": compliance_rate,
            "expected_deliverables": validated,
            "passing_compliance": compliant,
            "needs_review": validated - compliant,
            "executive_summary": (
                f"Validated {validated} records against the audited library: "
                f"{compliant} exist in the library, {summary.true_missing} truly missing, "
                f"{summary.pcs_mapping_review + summary.naming_review + summary.classification_review} need review."
            ),
            **summary_dict,
            "detected_columns": result.detected_columns,
        },
        "findings": _library_validation_findings(result.detailed_results),
        "workbook_b64": base64.b64encode(workbook.getvalue()).decode("ascii"),
        "workbook_filename": "Library_Validation_Results.xlsx",
    }


def _run_id3_validation(payload: dict[str, Any]) -> dict[str, Any]:
    from protech_validation_engine.si_library.id3_validation import (
        compare_chart_to_rules,
        write_id3_workbook,
    )

    chart_bytes = base64.b64decode(payload["mc_bytes_b64"])
    rules_bytes = base64.b64decode(payload["rules_bytes_b64"])

    result = compare_chart_to_rules(
        chart_bytes,
        rules_bytes,
        chart_filename=str(payload.get("mc_filename") or ""),
        rules_filename=str(payload.get("rules_filename") or ""),
    )

    checked = result.matched + result.mismatched + result.not_covered_by_rules
    compliance_rate = round((result.matched / checked) * 100, 1) if checked else None
    workbook = write_id3_workbook(result)

    return {
        "status": "completed",
        "run_summary": {
            "engine_id": "id3_validation",
            "manufacturer": None,
            "compliance_rate": compliance_rate,
            "expected_deliverables": result.rule_rows,
            "passing_compliance": result.matched,
            "needs_review": result.mismatched
            + result.missing_from_chart
            + result.not_covered_by_rules,
            "executive_summary": (
                f"Compared {result.chart_rows} chart rows against {result.rule_rows} rules: "
                f"{result.matched} compliant, {result.mismatched} rule mismatches, "
                f"{result.missing_from_chart} missing from the chart, "
                f"{result.not_covered_by_rules} not covered by any rule."
            ),
            "key_columns": result.key_columns,
            "compared_columns": result.value_columns,
        },
        "findings": result.findings,
        "workbook_b64": base64.b64encode(workbook.getvalue()).decode("ascii"),
        "workbook_filename": "ID3_Validation_Results.xlsx",
    }


def run_job(payload: dict[str, Any]) -> dict[str, Any]:
    job_type = str(payload.get("job_type") or "si_library_audit")
    if job_type == "library_validation":
        return _run_library_validation(payload)
    if job_type == "id3_validation":
        return _run_id3_validation(payload)
    return _run_si_library_audit(payload)


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        result = run_job(payload)
        json.dump(result, sys.stdout)
        return 0
    except Exception as exc:  # noqa: BLE001 — worker boundary returns structured error
        json.dump({"status": "failed", "error": str(exc)}, sys.stdout)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
