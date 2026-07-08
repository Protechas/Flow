"""Tests for stdin/stdout job runner."""

from __future__ import annotations

import base64
import json
from io import BytesIO

import pandas as pd

from protech_validation_engine.si_library.config import load_settings
from protech_validation_engine.worker.job_runner import run_job


def _payload() -> dict:
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

    settings = load_settings()
    return {
        "mc_bytes_b64": base64.b64encode(mc_buf.getvalue()).decode("ascii"),
        "export_bytes_b64": base64.b64encode(od_buf.getvalue()).decode("ascii"),
        "mc_filename": "acura_chart.xlsx",
        "export_filename": "acura_export.xlsx",
        "settings_snapshot": settings.to_dict(),
    }


def test_job_runner_payload() -> None:
    result = run_job(_payload())
    assert result["status"] == "completed"
    assert result["workbook_b64"]
    assert result["pdf_b64"]
    assert result["run_summary"]["manufacturer"] == "Acura"

    # round-trip JSON serialization
    encoded = json.dumps(result)
    parsed = json.loads(encoded)
    assert parsed["status"] == "completed"
