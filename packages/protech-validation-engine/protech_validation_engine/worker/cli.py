"""CLI for local audit runs without Streamlit."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from protech_validation_engine.runner import build_job_result, execute_audit
from protech_validation_engine.si_library.config import load_settings


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Run SI Library audit from the command line")
    parser.add_argument("--mc", required=True, help="Path to manufacturer chart Excel file")
    parser.add_argument("--export", required=True, help="Path to OneDrive export Excel file")
    parser.add_argument("--out-dir", default=".", help="Directory for workbook and PDF output")
    parser.add_argument("--json", action="store_true", help="Print job result JSON to stdout")
    args = parser.parse_args(argv)

    mc_path = Path(args.mc)
    export_path = Path(args.export)
    if not mc_path.is_file():
        print(f"MC file not found: {mc_path}", file=sys.stderr)
        return 1
    if not export_path.is_file():
        print(f"Export file not found: {export_path}", file=sys.stderr)
        return 1

    settings = load_settings()
    output = execute_audit(
        mc_path.read_bytes(),
        export_path.read_bytes(),
        mc_filename=mc_path.name,
        onedrive_filename=export_path.name,
        settings=settings,
    )

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    workbook_path = out_dir / output.output_name
    pdf_path = out_dir / output.pdf_filename
    workbook_path.write_bytes(output.workbook_bytes)
    pdf_path.write_bytes(output.pdf_bytes)

    print(f"Wrote {workbook_path}")
    print(f"Wrote {pdf_path}")
    print(f"Manufacturer: {output.result.manufacturer}")
    print(f"Compliance: {output.result.dashboard.get('Compliance Rate (%)')}%")

    if args.json:
        print(json.dumps(build_job_result(output), indent=2, default=str))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
