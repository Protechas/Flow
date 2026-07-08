# protech-validation-engine

Portable Python validation engines extracted from the ProTech SI Library Audit Tool for use by **Flow Validation Center**.

## What this package owns

- File parsing and manufacturer chart ↔ OneDrive matching
- Library validation logic (future engine handlers)
- Scoring, Excel workbook generation, executive PDF generation

## What this package does NOT own

- Users, authentication, permissions
- Tasks, projects, QA workflows
- Supabase storage or job queue (Flow worker adapter in Phase 2)

## Install (editable)

```bash
cd packages/protech-validation-engine
pip install -e ".[dev]"
```

## CLI

```bash
python -m protech_validation_engine.worker.cli --mc chart.xlsx --export export.xlsx --out-dir ./out
```

## Tests

```bash
pytest
```

## Audit App integration

The desktop Audit Tool can install this package and delegate core execution to `protech_validation_engine.runner.execute_audit`, keeping SQLite persistence in the local `audit_runner.py` wrapper.
