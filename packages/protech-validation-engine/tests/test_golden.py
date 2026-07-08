"""Golden tests for SI Library audit pipeline."""

from __future__ import annotations

from io import BytesIO

import pandas as pd

from protech_validation_engine.runner import build_job_result, execute_audit, normalize_findings
from protech_validation_engine.si_library.benchmark import validate_acura_benchmark
from protech_validation_engine.si_library.config import ACURA_BENCHMARK, load_settings


def _synthetic_workbooks() -> tuple[bytes, bytes]:
    mc = pd.DataFrame(
        [
            {
                "Year": "2026",
                "Make": "Acura",
                "Model": "ADX",
                "Feature": "BUC",
                "Calibration Type": "No Cal Req",
                "SME Generic System Name": "BUC",
                "Tertiary Key": "K1",
            }
        ]
    )
    od = pd.DataFrame(
        [{"Name": "2026 Acura ADX (BUC).pdf", "Item Type": "Item", "Path": "Acura/2026/ADX"}]
    )
    mc_buf, od_buf = BytesIO(), BytesIO()
    with pd.ExcelWriter(mc_buf, engine="openpyxl") as writer:
        mc.to_excel(writer, sheet_name="Chart", index=False)
    with pd.ExcelWriter(od_buf, engine="openpyxl") as writer:
        od.to_excel(writer, sheet_name="Export", index=False)
    return mc_buf.getvalue(), od_buf.getvalue()


def test_synthetic_audit_pipeline() -> None:
    settings = load_settings()
    mc_bytes, od_bytes = _synthetic_workbooks()
    output = execute_audit(
        mc_bytes,
        od_bytes,
        mc_filename="acura_chart.xlsx",
        onedrive_filename="acura_export.xlsx",
        settings=settings,
    )

    assert len(output.workbook_bytes) > 1000
    assert len(output.pdf_bytes) > 500
    assert "Expected MC Deliverables" in output.result.dashboard
    assert output.result.manufacturer == "Acura"


def test_job_result_shape() -> None:
    settings = load_settings()
    mc_bytes, od_bytes = _synthetic_workbooks()
    output = execute_audit(
        mc_bytes,
        od_bytes,
        mc_filename="acura_chart.xlsx",
        onedrive_filename="acura_export.xlsx",
        settings=settings,
    )
    payload = build_job_result(output)
    assert payload["status"] == "completed"
    assert payload["run_summary"]["engine_id"] == "si_library_audit"
    assert isinstance(payload["findings"], list)


def test_acura_benchmark_validator() -> None:
    passing_dashboard = {
        "Expected MC Deliverables": ACURA_BENCHMARK["expected_deliverables"],
        "Passing Compliance": ACURA_BENCHMARK["passing_compliance"],
        "Needs SI/PCS Review": ACURA_BENCHMARK["needs_review"],
        "Compliance Rate (%)": 84.1,
    }
    result = validate_acura_benchmark(passing_dashboard, "Acura")
    assert result and result.get("status") == "pass"

    bad_dashboard = dict(passing_dashboard)
    bad_dashboard["Passing Compliance"] = 100
    bad_result = validate_acura_benchmark(bad_dashboard, "Acura")
    assert bad_result and bad_result.get("status") == "warning"


def test_normalize_findings_skips_exact_matches() -> None:
    settings = load_settings()
    mc_bytes, od_bytes = _synthetic_workbooks()
    output = execute_audit(
        mc_bytes,
        od_bytes,
        mc_filename="acura_chart.xlsx",
        onedrive_filename="acura_export.xlsx",
        settings=settings,
    )
    findings = normalize_findings(output)
    for finding in findings:
        assert finding["match_status"] != "Exact Match"
