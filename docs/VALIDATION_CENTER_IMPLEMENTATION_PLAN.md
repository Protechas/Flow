# Validation Center — Implementation Plan

**Status:** Approved direction — implementation plan (no code in this document)  
**Date:** June 2026  
**Supersedes naming:** "Library Audit Center" → **Validation Center** (platform module) with **SI Library Audit** as engine #1  
**Prior art:** [LIBRARY_AUDIT_CENTER_INTEGRATION_PROPOSAL.md](./LIBRARY_AUDIT_CENTER_INTEGRATION_PROPOSAL.md)

---

## Executive Summary

Flow is becoming the **enterprise operating platform** for the department. The SI Library Audit Tool is not being merged or rewritten — it is being **promoted** into Flow as the first **validation engine** inside a new native module called **Validation Center**.

| System | Owns |
|--------|------|
| **Flow** | UX, auth, permissions, projects, tasks, teams, files, QA, reports, dashboards, notifications, activity, KPIs, accountability |
| **Python audit engine** | File parsing, MC↔OneDrive matching, library validation, scoring, Excel/PDF generation — **unchanged logic** |

**Flow orchestrates. The audit engine calculates.**

Users experience **one application**. They never open Streamlit, never see a second login, never manage tasks outside Flow.

**Findings are the bridge** — normalized operational records that link audit intelligence to Flow tasks, QA, project health, and executive reporting.

---

## Philosophy & Non-Negotiables

### Flow MUST own

- Navigation, authentication, permissions
- Projects, programs, work packages, tasks
- QA workflow, file attachments (operational evidence)
- Reports, analytics, executive dashboards, team dashboards
- Notifications and activity history
- KPI tracking and accountability

### Audit engine MUST own

- `audit_engine.py` — manufacturer chart ↔ OneDrive matching
- `library_validation_engine.py` — external report validation
- `executive_intelligence.py` — enrichment and confidence
- `excel_writer.py`, `pdf_writer.py`, `library_validation_export.py`
- `auto_pairing.py`, scoring, rollup calculations
- All pandas/openpyxl/reportlab processing

### Explicitly forbidden

| Forbidden | Reason |
|-----------|--------|
| Rewrite pandas matching in TypeScript | Regression risk on compliance math |
| Copy Python into React | Wrong layer |
| Iframe Streamlit | Broken auth/UX; not native |
| Parallel auth or task systems | Flow is system of record |
| Duplicate reporting in Excel-only silos | Findings must live in Supabase |
| Hardcode UI for SI Library only | Validation Center must accept future engines |

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FLOW — Validation Center (React/Next.js)         │
│  /validation          Dashboard                                          │
│  /validation/new      New validation run (engine picker → SI Library)    │
│  /validation/runs     Audit runs list                                    │
│  /validation/findings Findings hub (all engines, searchable)             │
│  /validation/corrections Correction tracker                              │
│  /validation/history  Revalidation & comparison                          │
│  /validation/reports  Exports & trends                                   │
│  /validation/analytics Engine KPIs & root-cause analytics                │
│  /validation/settings Admin rules (SI engine settings)                     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Server Actions + RLS
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE — validation domain (source of truth)        │
│  validation_engines · validation_runs · validation_files · validation_jobs│
│  validation_findings · validation_finding_tasks · validation_corrections │
│  validation_reports · validation_scores · validation_settings            │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ Job queue poll / webhook
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              PROTECH VALIDATION WORKER (Python — extracted package)      │
│  Package: protech-validation-engine (from Audit App, unchanged logic)    │
│  Handlers: si_library_audit · si_library_external_validation (future)     │
│  Input: storage paths + settings JSON                                    │
│  Output: normalized finding rows + artifact paths + run summary JSON     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ (never touches users/tasks directly)
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    FLOW — existing operational layer                     │
│  projects · manufacturers · year_work_items · work_items · qa_reviews    │
│  notifications · project_metric_definitions · executive dashboard        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Service boundary contract

**Flow → Worker (job payload):**

```json
{
  "job_id": "uuid",
  "engine_id": "si_library_audit",
  "run_id": "uuid",
  "input_files": [
    { "role": "manufacturer_chart", "storage_path": "..." },
    { "role": "onedrive_export", "storage_path": "..." }
  ],
  "settings_snapshot": { "...AuditSettings..." },
  "callback_url": "internal"
}
```

**Worker → Flow (job result):**

```json
{
  "job_id": "uuid",
  "status": "completed",
  "run_summary": {
    "manufacturer": "Acura",
    "compliance_rate": 84.2,
    "expected_deliverables": 744,
    "passing_compliance": 626,
    "needs_review": 118,
    "match_counts": { "exact": 500, "missing": 12, "...": "..." }
  },
  "findings": [ { "...normalized row..." } ],
  "artifacts": [
    { "role": "output_workbook", "storage_path": "..." },
    { "role": "output_pdf", "storage_path": "..." }
  ],
  "executive_summary": "text"
}
```

Worker **never** writes to `work_items`, `users`, or auth tables. Flow ingests results in a idempotent `completeValidationJob` server action.

---

## Multi-Engine Platform Design

Validation Center is a **platform module**. SI Library Audit is **engine registration #1**.

### `validation_engines` registry (config table)

| engine_id | label | status | handler |
|-----------|-------|--------|---------|
| `si_library_audit` | SI Library Audit | active | Python: `run_si_library_audit` |
| `si_library_external` | SI External Report Validation | planned | Python: `run_library_validation` |
| `id3_validation` | ID³ Validation | future | TBD |
| `oem_validation` | OEM Validation | future | TBD |
| `document_validation` | Document Validation | future | TBD |

Each engine declares:

- Required input file roles
- Output finding schema version
- Supported root cause taxonomy (can extend global enum)
- Default severity mapping rules
- Settings schema (JSON Schema in DB)

UI dynamically renders **New Validation** wizard based on selected engine — no hardcoded SI-only forms in shared components.

---

## Finding Model (The Bridge)

Every finding is a first-class Flow entity — not a spreadsheet row.

### Core fields (all engines)

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| validation_run_id | UUID FK | Source run |
| engine_id | text | Which engine produced it |
| title | text | Display title (auto-generated, editable) |
| severity | enum | critical · high · medium · low · info |
| status | enum | open · in_review · task_created · corrected · resolved · dismissed |
| root_cause | enum | See taxonomy below |
| confidence_score | int | 0–100 |
| suggested_correction | text | Action guidance |
| manufacturer | text | OEM |
| affected_record_ref | JSONB | Engine-specific: year, model, VIN, RO, etc. |
| source_file_id | UUID FK nullable | Link to uploaded file |
| evidence | JSONB | Match notes, filenames, engine raw row |
| work_item_id | UUID FK nullable | Linked Flow task |
| assigned_owner_id | UUID FK nullable | Denormalized from task |
| qa_status | enum nullable | pending · pass · fail · n/a |
| resolution_date | timestamptz nullable | When resolved/dismissed |
| prior_finding_id | UUID FK nullable | Repeat finding linkage |
| revalidation_history | JSONB | Array of { run_id, status, date } |
| search_vector | tsvector | Full-text search |
| created_at, updated_at | timestamptz | |

### Root cause taxonomy (global, extensible)

| Value | Description |
|-------|-------------|
| `library_issue` | Missing/wrong library file |
| `oem_data_issue` | OEM chart data problem |
| `import_issue` | OneDrive/export/import gap |
| `employee_error` | Human data entry |
| `missing_data` | Required field absent |
| `rule_mismatch` | Alias/split/placeholder rule edge case |
| `system_logic_issue` | Engine classification dispute |
| `unknown` | Unclassified |
| `needs_investigation` | Requires manager review |

**SI Library engine mapping** (worker-side, config not code change):

| Match Status | Default severity | Default root cause |
|--------------|------------------|-------------------|
| Missing From OneDrive Export | high | library_issue |
| Potential Classification/Naming Mismatch | medium | rule_mismatch |
| Split File Naming Difference | medium | rule_mismatch |
| Split File Present | low | rule_mismatch |
| Exact Match | info | — (passing, optional store) |

Validation classifications from `library_validation_engine.py` map similarly when engine `si_library_external` is enabled.

### Search & filter (Phase 3 UI)

- Full-text on title, manufacturer, evidence notes
- Filters: engine, run, severity, status, root cause, manufacturer, has_task, QA status, date range
- Grouping: by manufacturer, severity, root cause, assignee

---

## User Experience Map

Single-app workflow — sidebar: **Operations → Validation Center**

```
Validation Center (dashboard KPIs)
    → New Audit [engine: SI Library Audit]
        → Upload MC + OneDrive
        → Run (queued → processing → complete)
    → Audit Runs → Run Detail (summary, files, findings preview, downloads)
    → Findings (search/filter, bulk select)
        → Finding drawer (evidence, root cause, history)
        → [Create Flow Tasks]
    → Corrections (findings with linked tasks, status)
    → Validation History (compare runs, revalidation)
    → Reports (exports, trends)
    → Analytics (root cause breakdown, manufacturer accuracy)
    → Settings (SI rules — admin only)
```

Employee path: notification → `/work/[task-id]` → complete correction → QA Center → finding auto-updates.

Executive path: Executive Dashboard KPI drilldown → Validation Center filtered view (no separate app).

---

## Flow Module Structure (Implementation Layout)

### Routes (Phase 1 shell)

```
flow/src/app/(app)/validation/
  page.tsx                    # Dashboard
  new/page.tsx                # New validation wizard
  runs/page.tsx               # Runs list
  runs/[id]/page.tsx          # Run detail
  findings/page.tsx           # Findings hub
  corrections/page.tsx        # Correction tracker
  history/page.tsx            # Revalidation & compare
  reports/page.tsx            # Reports & exports
  analytics/page.tsx          # Analytics & root cause
  settings/page.tsx           # Engine settings (admin)
```

### Components

```
flow/src/components/validation-center/
  validation-dashboard.tsx
  validation-engine-picker.tsx
  new-audit-wizard/           # Step components; engine-aware
  validation-runs-table.tsx
  validation-run-detail.tsx
  validation-findings-table.tsx
  validation-finding-drawer.tsx
  create-tasks-from-findings-dialog.tsx
  validation-corrections-view.tsx
  validation-compare-view.tsx
  validation-reports-view.tsx
  validation-analytics-view.tsx
  validation-settings-form.tsx   # SI rules UI (mirrors Rules Manager)
  validation-empty-states.tsx
```

### Library layer

```
flow/src/lib/validation-center/
  types.ts                    # Engine-agnostic types
  engines/registry.ts         # Engine metadata (not Python)
  permissions.ts              # validation:* permission helpers
  finding-mapper.ts           # Severity/root cause display
  task-bridge.ts              # Finding → work_item mapping (Phase 4)
  kpi-engine.ts               # Validation KPI calculations
  search.ts                   # Finding query builders
  revalidation.ts             # Compare runs (Phase 5)

flow/src/lib/data/
  validation-center-db.ts     # Supabase CRUD
  validation-hydrate.ts       # Optional flow-store cache

flow/src/app/actions/
  validation-center.ts        # Server actions
```

### Python package (Phase 2 prep — separate repo or `packages/validation-engine/`)

```
protech_validation_engine/
  __init__.py
  si_library/
    audit_engine.py          # MOVED verbatim from Audit App
    library_validation_engine.py
    executive_intelligence.py
    excel_writer.py
    pdf_writer.py
    auto_pairing.py
    audit_runner.py            # Adapted: no SQLite, returns JSON
  worker/
    main.py                    # Poll validation_jobs or HTTP
    handlers.py                # engine_id → handler
    supabase_client.py         # Download uploads, upload artifacts
  tests/
    golden/                    # Acura benchmark + OEM fixtures
```

**Audit App desktop** refactors to `import protech_validation_engine` — proves extraction without changing user-facing desktop behavior during transition.

---

## Permissions

### New permission strings

```
validation:view
validation:create
validation:run
validation:review
validation:create_tasks
validation:manage_settings
validation:export
validation:admin
```

Register in `flow/src/lib/auth/permissions.ts`:

- `ROUTE_PERMISSIONS` for `/validation/*`
- `ROUTE_ROLE_ALLOWLIST`
- `NAV_CONFIG` entry: `{ id: "validation-center", href: "/validation", label: "Validation Center", icon: "ShieldCheck", group: "operations", ... }`

### Role matrix (unchanged from prior proposal)

| Action | Admin | Sr Mgr | Manager | Team Lead | Employee |
|--------|-------|--------|---------|-----------|----------|
| View / dashboard | ✅ | ✅ | ✅ team | ✅ team | ❌ |
| Upload & run | ✅ | ✅ | ✅ | ✅ | ❌ |
| Review findings | ✅ | ✅ | ✅ | ✅ | ❌ |
| Create tasks | ✅ | ✅ | ✅ | ✅ | ❌ |
| Settings | ✅ | ❌ | ❌ | ❌ | ❌ |

Employees interact only via assigned **tasks** on `/work`.

---

## Task Integration (Phase 4 Detail)

### "Create Flow Tasks" flow

1. User selects N findings in `validation-findings-table.tsx`
2. Opens `create-tasks-from-findings-dialog.tsx`
3. Preview: title, priority, project, assignee, QA/files flags per finding
4. Server action `createTasksFromValidationFindingsAction()`:
   - Resolve project (from run or picker)
   - Resolve operating model via `buildOperatingContext()` for department/team
   - For each finding:
     - Find/create `manufacturer` under project
     - Find/create `year_work_item` from affected_record_ref.year
     - Create `work_item` with mapped fields
     - Insert `validation_finding_tasks` bridge row
     - Update finding.status → `task_created`
     - Attach audit artifact reference in task description
   - `writeAuditLog()`, notifications to assignees
   - Revalidate `/operations`, `/validation/findings`, project detail

### Finding → Task field mapping

| Finding | Flow work_item |
|---------|----------------|
| title | title |
| severity → priority | urgent/high/medium/low |
| manufacturer | manufacturer (workstream) row |
| affected_record_ref.year | year_work_item |
| suggested_correction + evidence | description (markdown block) |
| validation_run_id + finding id | footer metadata + future custom field |
| engine evidence files | link in description; optional copy to task_file_uploads |
| severity ≥ high | qa_required = true |
| root_cause = library_issue | files_required = true |

### Status sync (event-driven in server actions)

| Event | Finding update |
|-------|----------------|
| Task → ready_for_qa | corrected |
| QA pass | resolved, resolution_date, qa_status=pass |
| QA fail | in_review, qa_status=fail |
| Task cancelled | open, clear work_item_id |

Hook into existing `submitQaReviewAction` with optional `validation_finding_id` lookup via bridge table — **minimal change** to QA action, not parallel QA system.

---

## Project Integration (Phase 5 Detail)

### Optional run → project link

`validation_runs.project_id` nullable FK. When set:

- Project detail gains tab: **Validation** (`project-validation-panel.tsx`)
- Shows: open findings, compliance rate, correction progress, last run date
- Project Health dashboard row includes validation KPIs from `validation-center/kpi-engine.ts`

### Hierarchy attachment

| Finding context | Flow entity |
|-----------------|-------------|
| manufacturer | `manufacturers` under project |
| year | `year_work_items` |
| model/system (metadata) | task description + finding.affected_record_ref |

### Project health strip addition

```
Project Health row:
  Health Score | Open Findings | Corrections Remaining | QA Progress | Forecast Impact
```

Forecast impact: count open critical/high findings weighted into existing intelligence engine (Phase 5 — read-only flag first, no auto-forecast change until validated).

---

## KPI Integration

### KPI definitions (engine-agnostic)

| KPI ID | Formula source | Surfaces |
|--------|----------------|----------|
| library_accuracy_pct | run.compliance_rate / avg confidence | Validation dashboard, Executive, Reports |
| audit_pass_rate | passing / expected | Same |
| critical_findings_open | count severity=critical, status open | Validation dashboard, Attention strip |
| findings_open | count status in open states | All |
| avg_correction_time | avg(task.done_at - task.created_at) | Analytics, Team scorecard |
| repeat_findings_rate | findings with prior_finding_id / total | Analytics, Executive |
| manufacturer_accuracy | validation_scores by OEM | Validation analytics |
| validation_coverage | validated records / expected | External validation engine |
| qa_approval_rate | QA pass on validation-linked tasks | QA reports |
| revalidation_improvement_pct | compare run N vs N-1 | History, Executive |
| audit_trends | time series compliance_rate | Reports, Executive drilldown |
| root_cause_breakdown | group by root_cause | Analytics |

### Integration points (by phase)

| Phase | Integration |
|-------|-------------|
| 3 | Validation Center dashboard KPIs only |
| 4 | Project detail tab counts |
| 5 | Executive dashboard strip (3 KPIs + drilldown link) |
| 5 | Team dashboard pack KPI extension |
| 5 | `/reports` panel + `/analytics` validation section |
| 5 | `project_metric_definitions` sync for linked projects |

**Rule:** No placeholder KPI numbers — compute from Supabase or show `—`.

---

## Database Schema (Consolidated)

Migration sequence (when approved — not in this phase):

| Migration | Tables |
|-----------|--------|
| `036_validation_center_core.sql` | validation_engines, validation_runs, validation_files, validation_jobs, validation_settings |
| `037_validation_findings.sql` | validation_findings + indexes + search_vector |
| `038_validation_work_bridge.sql` | validation_finding_tasks, validation_corrections |
| `039_validation_reporting.sql` | validation_reports, validation_scores, validation_revalidation_links |

Naming uses `validation_*` prefix (not `audit_*`) to support non-audit engines (ID³, document validation) without schema rename.

Storage bucket: `validation-files` (replaces earlier `library-audit-files` naming).

RLS: authenticated read scoped by department/team via join to run; write via permission-checked server actions.

---

## Build Phases — Detailed Implementation Steps

### Phase 1 — Validation Center Shell (Flow only)

**Goal:** Native module exists; zero engine integration.

| Step | Deliverable |
|------|-------------|
| 1.1 | Register permissions + nav in `permissions.ts` |
| 1.2 | Create route tree under `/validation/*` with `FlowPageShell` placeholders |
| 1.3 | `validation-dashboard.tsx` — empty KPI strip + "New Validation" CTA |
| 1.4 | `validation-engine-picker.tsx` — SI Library Audit card (only active engine) |
| 1.5 | Placeholder pages: runs, findings, corrections, history, reports, analytics, settings |
| 1.6 | Add Help & Docs article; Settings hub link |
| 1.7 | `requirePageAccess("/validation")` on all routes |

**Exit criteria:** Sidebar shows Validation Center; all routes render; no Python; no DB migration required (optional seed `validation_engines` row via code constant).

**Parallel track (Phase 1b — Python, no Flow dependency):**

| Step | Deliverable |
|------|-------------|
| 1b.1 | Create `protech_validation_engine` package; copy modules verbatim |
| 1b.2 | Remove SQLite calls from runner; return dataclass/JSON result |
| 1b.3 | Golden tests against Audit App outputs (Acura benchmark in `config.py`) |
| 1b.4 | CLI: `python -m protech_validation_engine.worker.cli run --mc --export` |
| 1b.5 | Refactor Audit App to import package (desktop still works) |

---

### Phase 2 — Connect Python Audit Engine

**Goal:** Upload → process → artifacts stored; run summary visible.

| Step | Deliverable |
|------|-------------|
| 2.1 | Migration `036_validation_center_core.sql` |
| 2.2 | Supabase bucket `validation-files` |
| 2.3 | `validation-center-db.ts` — create run, files, job |
| 2.4 | `new-audit-wizard` — upload MC + OneDrive, metadata form |
| 2.5 | `createValidationRunAction()` — stores files, enqueues job |
| 2.6 | Python worker — poll `validation_jobs`, execute `si_library_audit` handler |
| 2.7 | `completeValidationJobAction()` — ingest summary + artifact paths |
| 2.8 | Run detail page — status polling, download workbook/PDF |
| 2.9 | Notification: "SI Library audit complete — {manufacturer} {rate}%" |
| 2.10 | Settings page — load/save `validation_settings` JSON (AuditSettings shape) |

**Exit criteria:** User completes full audit in Flow; gets same workbook/PDF as desktop tool; run record in Supabase; Audit App still usable in parallel.

**Worker deployment:** Single Docker container or Windows service on ProTech infra; polls Supabase `validation_jobs` where `status = pending`. Not in Vercel serverless.

---

### Phase 3 — Normalized Findings

**Goal:** Findings searchable operational data.

| Step | Deliverable |
|------|-------------|
| 3.1 | Migration `037_validation_findings.sql` |
| 3.2 | Worker extended — bulk insert findings JSON (batch 500 rows) |
| 3.3 | Map engine output → finding rows + severity + root_cause defaults |
| 3.4 | `validation-findings-table.tsx` — paginated, filterable |
| 3.5 | `validation-finding-drawer.tsx` — full evidence, edit root cause |
| 3.6 | Full-text search via `search_vector` |
| 3.7 | Dashboard KPIs wired to real counts |
| 3.8 | Run detail — findings tab with inline preview |

**Exit criteria:** Manager can search/filter 1000+ findings; no Excel required for review.

---

### Phase 4 — Task Creation & Corrections

**Goal:** Findings become Flow work.

| Step | Deliverable |
|------|-------------|
| 4.1 | Migration `038_validation_work_bridge.sql` |
| 4.2 | `task-bridge.ts` — mapping logic |
| 4.3 | `create-tasks-from-findings-dialog.tsx` |
| 4.4 | `createTasksFromValidationFindingsAction()` |
| 4.5 | QA action hook — sync finding status on QA result |
| 4.6 | `validation-corrections-view.tsx` |
| 4.7 | Operations board badge — "Validation correction" on linked tasks |
| 4.8 | Activity + audit log entries |

**Exit criteria:** Select findings → tasks appear in Operations; employee completes; QA closes finding.

---

### Phase 5 — Revalidation, Trends & Executive Integration

**Goal:** Continuous improvement visible at all levels.

| Step | Deliverable |
|------|-------------|
| 5.1 | Migration `039_validation_reporting.sql` |
| 5.2 | Revalidation run links (`prior_run_id`) |
| 5.3 | `validation-compare-view.tsx` — port Compare Audits + What Changed UX |
| 5.4 | `validation_scores` nightly snapshot job |
| 5.5 | Executive dashboard — 3 KPI tiles + link to `/validation` |
| 5.6 | Project health + project detail validation panel |
| 5.7 | `/analytics` validation section + root cause charts |
| 5.8 | Team dashboard pack seed for SI / Service Information team |
| 5.9 | External validation engine handler (`si_library_external`) |
| 5.10 | Audit App desktop — deprecation banner; read-only archive period |

**Exit criteria:** Executive sees audit trends; revalidation shows improvement %; project health includes findings; desktop app retired.

---

## Audit Tool Page → Validation Center Mapping

| Audit App page | Validation Center destination | Phase |
|----------------|--------------------------------|-------|
| Home / Run Audit | `/validation/new` | 2 |
| Past Audits | `/validation/runs` | 2 |
| Review Explorer | `/validation/findings` | 3 |
| Audit Queue | `/validation/new` (batch mode) | 2.5 |
| Compare Audits | `/validation/history` | 5 |
| What Changed | `/validation/history` | 5 |
| Library Validation Center | `/validation/new` (engine: external) | 5.9 |
| Executive Rollup | `/validation` dashboard + Executive | 5 |
| Library Score | `/validation/analytics` | 5 |
| Historical Trends | `/validation/reports` | 5 |
| Manufacturer History | `/validation/runs?manufacturer=` | 3 |
| Library Health Center | `/validation/analytics` | 5 |
| Rules Manager | `/validation/settings` | 2 |
| Settings | `/validation/settings` | 2 |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Engine regression | Golden tests in Phase 1b before Flow wiring |
| Worker ops | Document deployment; start single-instance poll |
| Finding volume | Bulk insert; paginate UI; archive policy |
| Scope creep (all Streamlit pages day 1) | Phase mapping above — defer analytics to Phase 5 |
| Engine coupling in UI | Engine registry + picker — never `if (si)` in shared tables |
| QA sync bugs | Single hook in existing QA action; integration tests |
| Dual-tool confusion | Feature flag `VALIDATION_CENTER_ENABLED`; comms plan |

---

## Success Criteria Checklist

| # | Criterion | Verified by |
|---|-----------|-------------|
| 1 | Single Flow UX — no second app | User testing |
| 2 | SI Audit native capability | Runs complete in `/validation` |
| 3 | Python logic intact | Golden tests pass |
| 4 | Findings → operational work | Phase 4 task bridge |
| 5 | Projects/QA/Tasks/Reports consume audit data | Phase 5 integrations |
| 6 | Future engines without redesign | `validation_engines` registry |
| 7 | No duplicate business logic | Code review boundary |
| 8 | Flow = users/work/accountability | Architecture review |
| 9 | Engine = calculations only | Worker contract review |

---

## Recommended Execution Order

```
Week 1-2:  Phase 1 (Flow shell) + Phase 1b (Python package extraction) in parallel
Week 3-5:  Phase 2 (upload, worker, artifacts)
Week 6-7:  Phase 3 (findings)
Week 8-9:  Phase 4 (tasks + QA)
Week 10+:  Phase 5 (executive, revalidation, retirement)
```

**First code PR (when approved):** Phase 1 only — routes, nav, permissions, placeholder UI. No migrations. No worker.

**Second PR:** Phase 1b — Python package + golden tests (separate from Flow deploy).

**Third PR:** Phase 2 — migrations + worker + upload flow.

---

## What Not To Do (Recap)

- Do not rename module back to "Library Audit Center" in code — **Validation Center** is the platform
- Do not embed Streamlit
- Do not port `audit_engine.py` to TypeScript
- Do not store findings only in Excel
- Do not create `audit_users` or separate auth
- Do not hardcode SI Library as the only route (`/validation/si-library/...`) — use engine picker
- Do not run pandas in Vercel serverless functions
- Do not skip Phase 1b golden tests before production audits in Flow

---

## Related Documents

- [LIBRARY_AUDIT_CENTER_INTEGRATION_PROPOSAL.md](./LIBRARY_AUDIT_CENTER_INTEGRATION_PROPOSAL.md) — discovery & data model detail (audit_* naming superseded by validation_*)
- [TEAM_OPERATING_MODELS.md](./TEAM_OPERATING_MODELS.md) — Service Information model for task defaults
- [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) — Flow platform layers

---

*This plan is ready for stakeholder approval. Upon approval, implementation begins with Phase 1 (Flow shell) and Phase 1b (Python extraction) as parallel workstreams.*
