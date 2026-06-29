# Library Audit Center — Integration Architecture Proposal

> **Superseded by:** [VALIDATION_CENTER_IMPLEMENTATION_PLAN.md](./VALIDATION_CENTER_IMPLEMENTATION_PLAN.md) — the platform module is **Validation Center**; SI Library Audit is the first validation engine. This document remains useful for discovery detail and table-level design notes (`audit_*` naming → `validation_*` in the new plan).

**Status:** Discovery complete — architecture proposal only  
**Date:** June 2026  
**Author:** Flow platform architecture review  
**Scope:** Integrate the ProTech SI Library Audit Tool into Flow as a native module called **Library Audit Center**

> **Explicitly out of scope for this document:** code changes, file moves, migrations, or implementation.

---

## Executive Summary

Flow is the correct **system of record** for operational work — projects, tasks, QA, accountability, reporting, and executive visibility. The SI Library Audit Tool is a mature **specialized audit intelligence engine** with deep domain logic (manufacturer chart ↔ OneDrive matching, validation against audited library, scoring, comparison, Excel/PDF outputs) that today runs as a **standalone Python/Streamlit desktop app** with **local SQLite + filesystem storage**.

**Recommendation:** Build **Library Audit Center** as a **native Flow module** (UI, permissions, data, workflows) powered by an **isolated audit processing engine** extracted from the Audit Tool (Option B). Do not iframe Streamlit. Do not copy the Streamlit UI into React. Do not duplicate audit results in disconnected spreadsheets.

The integration turns audit outputs into **trackable operational work** inside Flow:

```
Audit Upload → Processing → Findings → Review → Flow Tasks → Corrections → QA → Re-validation → Reports → Executive Trends
```

**Recommended first build phase:** Phase 2 — Library Audit Center shell + Phase 3 upload/runs metadata (see Migration Plan), with audit engine extraction (Phase 1) running in parallel as a bounded Python worker service.

---

## Current Flow Architecture Summary

### Platform stack

| Layer | Technology | Location |
|-------|------------|----------|
| App framework | Next.js 16 App Router, React 19 | `flow/src/app/` |
| Auth | Supabase Auth + role/permission model | `flow/src/lib/auth/` |
| Data | Supabase PostgreSQL + in-memory `flow-store` hybrid | `flow/supabase/migrations/`, `flow/src/lib/data/` |
| Files | Supabase Storage (`company-documents`) + `task_file_uploads` | migrations `005`, `019` |
| UI system | Executive Dark theme, `FlowPageShell`, `KpiStrip`, shadcn/ui | `flow/src/components/platform/`, `globals.css` |

### Relevant existing domain hooks (SI / Library)

Flow already anticipates SI library work — no dedicated audit module yet:

| Asset | Purpose |
|-------|---------|
| `si_corrections` project type | SI correction programs |
| `si_library_board` board template | "Organize SI library audits and maintenance work" |
| `audit_validation` enterprise template | Library audits, validation, compliance reviews |
| `SERVICE_INFORMATION_MODEL` operating model | Manufacturer / Year / Task labels, documents/QA/corrections KPIs |
| Preset tasks | `["SI audit", "Correction entry", "Peer review", "QA sign-off"]` |
| Smart labels | Manufacturer/Year hierarchy for `si_corrections` |

**Key paths:**
- Templates: `flow/src/lib/work-creation/templates.ts`, `flow/src/lib/templates/builtin-templates.ts`
- Operating model: `flow/src/lib/operating-models/presets.ts`
- Work creation: `flow/src/components/work-creation/program-builder.tsx`, `create-task-composer.tsx`
- QA: `flow/src/app/(app)/qa-center/page.tsx`, `flow/src/app/actions/qa.ts`

### Flow work hierarchy (operational model)

```
Project (program)
 └── Manufacturer / Workstream (work package)
      └── Year / Phase (year_work_item)
           └── Task (work_items / work package)
```

The Service Information operating model maps audit concepts naturally:
- **Manufacturer** → audit scope / OEM
- **Year** → model year bucket
- **Task** → correction, SI audit step, QA sign-off

### Extension patterns already proven in Flow

| Pattern | Example | Reuse for Library Audit Center |
|---------|---------|--------------------------------|
| Dedicated route module | Innovation Hub (`/innovation-hub`) | `/library-audit/*` routes |
| JSONB config packs | `team_dashboard_packs`, `team_operating_models` | Audit settings profiles (optional) |
| Custom project metrics | `project_metric_definitions` | Audit KPIs on programs |
| Notifications | `notifications` + producers | Audit complete, critical findings |
| Server actions + audit log | All `flow/src/app/actions/*` | Audit mutations |
| Team dashboards | `/teams/[slug]` | SI team audit dashboard pack |

### Flow gaps relative to audit needs

- No long-running **job/worker** pattern for CPU-heavy Excel processing (today: synchronous server actions)
- Work packages are the task model — findings need a **bridge entity** before task creation
- File storage for large audit workbooks needs a dedicated bucket (not company SOPs)
- Partial hybrid persistence on work packages — audit module should be **fully Supabase-backed from day one**

---

## Current Audit Tool Architecture Summary

### Platform stack

| Layer | Technology | Location |
|-------|------------|----------|
| UI | Streamlit (multi-page) | `Audit App/app.py`, `Audit App/pages/*.py` |
| Language | Python 3 + pandas | Core engines |
| Persistence | SQLite (local) | `%LOCALAPPDATA%/ProTech_SI_Audit_Tool/audit_repository.db` |
| File storage | Local filesystem | `repository_files/` under app data folder |
| Settings | JSON on disk | `config.py` → `AuditSettings` dataclass |
| Packaging | PyInstaller desktop `.exe` | `Audit App/build/` |
| Auth | None (single-user desktop) | — |

### Application pages (current capabilities)

| Page | File | Capability |
|------|------|------------|
| Home / Run Audit | `app.py` | Upload MC + OneDrive → run audit |
| Executive Rollup | `pages/2_Executive_Rollup.py` | Org-wide compliance rollup |
| Library Score | `pages/3_Library_Score.py` | Master scoreboard |
| Historical Trends | `pages/4_Historical_Trends.py` | Trend charts |
| Library Validation Center | `pages/4_Library_Validation_Center.py` | Validate external reports vs audit DB |
| Past Audits | `pages/5_Past_Audits.py` | Audit history |
| Manufacturer History | `pages/6_Manufacturer_History.py` | Per-OEM timeline |
| Compare Audits | `pages/7_Compare_Audits.py` | Run A vs Run B |
| Audit Queue | `pages/8_Audit_Queue.py` | Batch auto-pair + run |
| Review Explorer | `pages/9_Review_Explorer.py` | Drill into review items |
| Library Health Center | `pages/10_Library_Health_Center.py` | Health leaderboard |
| What Changed | `pages/11_What_Changed.py` | Delta analysis |
| Rules Manager | `pages/12_Rules_Manager.py` | Model aliases, split patterns, placeholders |
| Settings | `pages/13_Settings.py` | Thresholds, rules persistence |

### Core processing pipeline

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│ Manufacturer    │     │ audit_engine.py  │     │ executive_intelligence  │
│ Chart (.xlsx)   │────▶│ run_audit()      │────▶│ build_executive_package │
│ OneDrive export │     │ (matching logic) │     │ enriched analytics      │
└─────────────────┘     └────────┬─────────┘     └────────────┬────────────┘
                                   │                            │
                    ┌──────────────┼──────────────┐             │
                    ▼              ▼              ▼             ▼
            excel_writer.py  pdf_writer.py  library_score_engine  audit_repository
            (workbook)       (executive PDF) (recalculate score)   (SQLite save)
```

**Orchestrator:** `audit_runner.py` → `execute_audit()`

### Core engine modules (reuse candidates)

| Module | Lines (approx) | Responsibility | Reuse priority |
|--------|----------------|----------------|----------------|
| `audit_engine.py` | ~1,100 | MC ↔ OneDrive matching, status taxonomy, filename normalization | **Critical — preserve exactly** |
| `library_validation_engine.py` | ~450 | External report validation vs audited library | **High** |
| `executive_intelligence.py` | ~330 | Enrichment, PCS defense, confidence, summaries | **High** |
| `library_score_engine.py` | ~400 | Master library score, snapshots | **High** |
| `audit_repository.py` | ~580 | SQLite CRUD, compare, history | **Replace** (Flow/Supabase owns data) |
| `excel_writer.py` / `pdf_writer.py` | — | Export artifacts | **Reuse** (worker-side) |
| `library_validation_export.py` | — | Validation workbook export | **Reuse** |
| `auto_pairing.py` | — | Batch file pairing for Audit Queue | **Reuse** |
| `audit_data_cache.py` | — | In-memory cache of audit DB for validation speed | **Reimplement** against Supabase |
| `config.py` | — | Rules, thresholds, model aliases | **Migrate** to `audit_settings` table |

### Audit output taxonomy (domain vocabulary)

**Match statuses** (`audit_engine.py`):
- Exact Match
- Split File Present
- Split File Naming Difference
- Potential Classification/Naming Mismatch
- Missing From OneDrive Export

**Validation classifications** (`library_validation_engine.py`):
- Library File Exists
- True Missing From Library
- PCS / Mapping Review Candidate
- Naming Review Required
- Classification Review Required
- No Matching Expected Record
- Manual Review Required

**Issue owners:** Compliant, SI Naming Review, Needs Human Review, SI / Export Gap Review, etc.

These enums must be preserved verbatim in Flow's data model to avoid breaking reporting continuity.

### Data currently stored (SQLite)

**`audits` table** — run-level summary:
- manufacturer, audit_date, expected_deliverables, passing_compliance, needs_review
- compliance_rate, missing_files, pcs_review_items
- match type counts, avg_confidence
- workbook_path, pdf_path, source_filename

**`library_snapshots`** — aggregate scoreboard over time

**Row-level detail:** Stored inside Excel workbooks on disk, loaded back via rollup/import — not normalized in SQLite today.

### Performance & constraints

- pandas + openpyxl — memory-heavy for large manufacturers
- ThreadPoolExecutor used for parallel workbook + PDF generation
- `audit_data_cache` warms latest audit data for validation (I/O bound)
- Desktop app assumes **local disk** and **single user**
- Streamlit `session_state` holds ephemeral UI state

### Dependencies (from `build/requirements.txt`)

pandas, openpyxl, streamlit, reportlab (PDF), sqlite3 (stdlib) — **no web framework, no auth, no cloud**

---

## Overlap Analysis

| Capability | Audit Tool today | Flow today | Integration approach |
|------------|------------------|------------|----------------------|
| Run MC ↔ OneDrive audit | ✅ Core engine | ❌ | Engine as worker; Flow stores results |
| External report validation | ✅ Validation engine | ❌ | Same engine; Flow UI |
| Manufacturer tracking | ✅ SQLite + scoreboard | ✅ `manufacturers` table on projects | Link audit runs to Flow manufacturers |
| Task assignment | ❌ | ✅ work_items | **Findings → tasks** (new bridge) |
| QA review | ❌ | ✅ QA Center | Finding resolution via QA |
| File evidence | ✅ Local xlsx/pdf | ✅ task_file_uploads, storage | Audit bucket + task attachments |
| Executive dashboards | ✅ Streamlit charts | ✅ `/executive`, team dashboards | Roll audit KPIs into existing dashboards |
| Permissions / multi-user | ❌ | ✅ Full RBAC | Flow owns access |
| Notifications | ❌ Activity feed only | ✅ Notification center | Audit events → notifications |
| Settings / rules | ✅ JSON + Rules Manager | ✅ Settings pages pattern | `audit_settings` admin |
| Batch audit queue | ✅ Audit Queue page | ❌ | Flow job queue UI |
| Compare audits | ✅ | ❌ (partial via metrics) | Native comparison views |
| Reporting export | ✅ Excel/PDF | ✅ CSV exports elsewhere | Keep exports via worker |

**Conclusion:** Minimal overlap in **processing logic**; significant overlap in **downstream operational needs** where Flow is already stronger. The Audit Tool should not remain the system of record for accountability — Flow should.

---

## Integration Options Comparison

### Option A — Native Flow Module (full port)

Move audit UI **and** rewrite all Python logic in TypeScript inside Flow.

| | |
|--|--|
| **Pros** | Single codebase; no worker infra; tightest UX integration |
| **Cons** | Highest risk; ~2,000+ lines of pandas matching logic to reimplement; regression risk on compliance calculations; long timeline |
| **Risk** | **High** — domain logic errors affect compliance reporting |
| **Best for** | Long-term only if Python worker is unacceptable |

### Option B — Audit Engine as Internal Library (recommended)

Extract Python engines into a **versioned package + job worker**. Flow owns UI, Supabase data, permissions, tasks, QA, dashboards.

| | |
|--|--|
| **Pros** | Preserves proven matching logic; Flow-native UX; clean separation; incremental migration; Audit Tool can remain as dev/testing harness during transition |
| **Cons** | Requires job runner (container/worker); Python ops in Node deployment; two-language maintenance |
| **Risk** | **Medium** — bounded at worker boundary with golden-file regression tests |
| **Best for** | **This integration** — specialized engine + platform shell |

**Worker invocation options (sub-decision):**

1. **Dedicated Python worker service** (FastAPI + Redis/Supabase queue) — **recommended for production**
2. **Subprocess from Next.js server action** — acceptable for Phase 1 pilot only (blocks request, deployment coupling)
3. **Port to TypeScript** — phased long-term goal, not initial delivery

### Option C — Standalone Audit Service (API only)

Audit Tool becomes a separate deployed API; Flow calls REST endpoints.

| | |
|--|--|
| **Pros** | Clear boundary; Audit Tool team can ship independently |
| **Cons** | Two deployments forever; auth bridging; duplicate user model; latency; still need Flow-side data model |
| **Risk** | **Medium-high** — organizational drift, dual source of truth |
| **Best for** | Multi-product scenarios where Audit Tool serves non-Flow clients |

### Recommendation: **Option B**

Flow becomes the platform. The audit **engines** become an internal ProTech library invoked by a **job worker**. Streamlit app enters maintenance mode, then retirement, after parity is reached.

---

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         FLOW — Library Audit Center (UI)                      │
│  /library-audit/dashboard | new | runs | findings | corrections | reports  │
│  FlowPageShell · permissions · notifications · task creation · QA links       │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ server actions / API
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    SUPABASE — audit domain tables (source of truth)         │
│  audit_runs · audit_files · audit_findings · audit_settings · jobs           │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ job queue (audit_jobs)
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│              AUDIT WORKER — Python package (extracted from Audit Tool)        │
│  audit_engine · library_validation_engine · executive_intelligence           │
│  excel_writer · pdf_writer · auto_pairing                                    │
│  Reads files from storage · writes findings + artifacts back to Supabase      │
└──────────────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                    FLOW — existing operational layer                          │
│  projects · manufacturers · work_items · qa_reviews · notifications         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Principles

1. **Findings are first-class entities** — not only Excel rows
2. **Tasks are created from findings** — explicit user action with mapping rules
3. **Audit artifacts immutably stored** — original uploads + generated workbooks versioned per run
4. **Settings/rules org-scoped** — migrate `AuditSettings` to Supabase, admin-editable
5. **No fake KPIs** — dashboard metrics computed from stored findings only
6. **Audit Tool keeps working** until Flow reaches parity — no big-bang cutover

---

## Data Model Proposal

### Entity relationship overview

```
projects ─────────────┐
departments / teams │
users                 │
                      ▼
                 audit_runs ───── audit_files
                      │
                      ├── audit_findings ─── audit_finding_tasks ─── work_items
                      │         │
                      │         └── audit_corrections (status history)
                      │
                      ├── audit_reports (generated artifact refs)
                      ├── audit_manufacturer_scores (denormalized rollup)
                      └── audit_validation_history (re-validation runs)

audit_settings (org rules — migrated from AuditSettings JSON)
audit_jobs (processing queue)
```

### Table specifications

#### `audit_runs`

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | Run identifier |
| slug / run_number | text | Human reference |
| manufacturer | text | OEM name (links to Flow `manufacturers` when on a project) |
| manufacturer_id | UUID FK nullable | Flow manufacturer when scoped to program |
| project_id | UUID FK nullable | Linked Flow program |
| department_id, team_id | UUID FK nullable | Scope |
| audit_type | enum | `library_audit`, `revalidation`, `external_validation` |
| status | enum | `draft`, `queued`, `processing`, `completed`, `failed` |
| compliance_rate | numeric nullable | Summary KPI |
| expected_deliverables, passing_compliance, needs_review | int | Dashboard counts |
| missing_files, pcs_review_items | int | Summary counts |
| avg_confidence | numeric nullable | |
| match_counts | JSONB | exact, split, mismatch, missing counts |
| executive_summary | text nullable | From executive_intelligence |
| uploaded_by | UUID FK users | |
| started_at, completed_at | timestamptz | |
| notes | text | |
| prior_run_id | UUID FK nullable | For re-validation linkage |
| settings_snapshot | JSONB | AuditSettings at run time (immutable) |
| created_at, updated_at | timestamptz | |

**Indexes:** `(manufacturer, completed_at DESC)`, `(project_id)`, `(status)`, `(team_id)`

#### `audit_files`

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| audit_run_id | UUID FK | |
| file_role | enum | `manufacturer_chart`, `onedrive_export`, `external_report`, `output_workbook`, `output_pdf` |
| storage_path | text | Supabase storage key |
| original_filename | text | |
| mime_type, byte_size | | |
| uploaded_by | UUID FK | |
| created_at | timestamptz | |

**Storage bucket:** `library-audit-files` (50–100MB limit, xlsx/pdf/csv)

#### `audit_findings`

Row-level normalized findings (extracted from enriched audit DataFrame post-run).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| audit_run_id | UUID FK | |
| row_index | int | Stable ordering within run |
| year, make, model | text | Vehicle context |
| feature, calibration_type | text nullable | MC fields |
| system_name, tertiary_key | text nullable | |
| expected_filename | text | |
| actual_filename | text nullable | |
| match_status | text | Audit Tool status enum |
| validation_classification | text nullable | For validation runs |
| confidence | int | 0–100 |
| issue_owner | text | Compliant / SI Naming Review / etc. |
| severity | enum | `critical`, `high`, `medium`, `low`, `info` (derived) |
| match_notes | text | Evidence |
| is_placeholder | boolean | |
| status | enum | `open`, `in_review`, `task_created`, `corrected`, `resolved`, `dismissed` |
| suggested_correction | text nullable | |
| work_item_id | UUID FK nullable | Linked Flow task |
| resolved_at, resolved_by | | |
| created_at | timestamptz | |

**Indexes:** `(audit_run_id)`, `(audit_run_id, match_status)`, `(audit_run_id, status)`, `(work_item_id)` where not null

**Volume note:** Large manufacturers may produce 1,000–10,000+ rows — index carefully; paginate UI.

#### `audit_finding_tasks`

Many-to-many bridge (one finding → one task typically, but batch creation may group).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| audit_finding_id | UUID FK | |
| work_item_id | UUID FK | |
| created_by | UUID FK | |
| batch_id | UUID nullable | Bulk create grouping |
| created_at | timestamptz | |

#### `audit_corrections`

Correction lifecycle beyond raw finding status (links to QA outcomes).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| audit_finding_id | UUID FK | |
| work_item_id | UUID FK | |
| qa_review_id | UUID FK nullable | |
| correction_status | enum | `assigned`, `in_progress`, `submitted`, `qa_pass`, `qa_fail`, `closed` |
| notes | text | |
| updated_at | timestamptz | |

#### `audit_reports`

Pointers to generated artifacts (workbook, PDF, validation export).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| audit_run_id | UUID FK | |
| report_type | enum | `executive_workbook`, `executive_pdf`, `validation_workbook` |
| audit_file_id | UUID FK | Links to `audit_files` |
| generated_at | timestamptz | |

#### `audit_manufacturer_scores`

Denormalized scoreboard (replaces SQLite library_snapshots + scoreboard queries).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| manufacturer | text | |
| manufacturer_id | UUID FK nullable | |
| snapshot_date | date | |
| last_audit_run_id | UUID FK | |
| expected, passing, review, missing, pcs_review | int | |
| compliance_pct | numeric | |
| created_at | timestamptz | |

**Indexes:** `(manufacturer, snapshot_date DESC)`

#### `audit_validation_history`

Tracks external validation runs against library.

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| audit_run_id | UUID FK | Parent library audit |
| validation_run_id | UUID FK | Child validation run |
| records_validated | int | |
| appear_compliant, true_missing, etc. | int | Summary columns from `LibraryValidationSummary` |
| improvement_pct | numeric nullable | vs prior validation |
| created_at | timestamptz | |

#### `audit_settings`

Org-level rules (migrated from `AuditSettings` + Rules Manager).

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| scope | enum | `org`, `department`, `team` |
| scope_id | UUID nullable | |
| settings | JSONB | model_aliases, split_patterns, placeholders, thresholds |
| updated_by | UUID FK | |
| updated_at | timestamptz | |

**Note:** Single org-wide row initially; extend for team overrides later.

#### `audit_jobs`

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID PK | |
| audit_run_id | UUID FK | |
| job_type | enum | `run_audit`, `validate_report`, `generate_exports`, `import_scoreboard` |
| status | enum | `pending`, `running`, `completed`, `failed` |
| worker_id | text nullable | |
| error_message | text nullable | |
| started_at, completed_at | timestamptz | |

### Connection to existing Flow entities

| Audit entity | Flow entity | Link strategy |
|--------------|-------------|---------------|
| audit_run.project_id | projects | Optional — audit may be ad hoc or program-scoped |
| audit_run.manufacturer_id | manufacturers | Auto-create manufacturer under project if needed |
| audit_finding → task | work_items | Explicit creation via composer |
| audit correction | qa_reviews | QA pass closes finding |
| audit_files | Supabase storage | New bucket; optional copy to task_file_uploads |
| KPIs | project_metric_definitions | Sync summary metrics to program |

---

## UI Proposal

**Design system:** Flow Executive Dark — `FlowPageShell`, `KpiStrip`, `OperationalPostureStrip`, `FilterToolbar`, `DetailDrawer`, `WorkspaceContainer`.

**Sidebar location:** **Operations** group (primary) with secondary links under **Attention** for open critical findings.

**Route map:**

| Page | Route | Description |
|------|-------|-------------|
| Audit Dashboard | `/library-audit` | KPI strip, recent runs, manufacturer scoreboard, open findings |
| New Audit | `/library-audit/new` | Wizard: upload MC + OneDrive, select manufacturer/project/team |
| Audit Runs | `/library-audit/runs` | Filterable table of all runs |
| Audit Run Detail | `/library-audit/runs/[id]` | Summary, files, findings preview, exports download |
| Findings | `/library-audit/findings` | Cross-run findings table with filters |
| Finding Detail | drawer on findings/run pages | Severity, evidence, suggested correction, actions |
| Corrections | `/library-audit/corrections` | Findings with linked tasks — status tracker |
| Validation History | `/library-audit/validation` | External validation runs + comparison |
| Audit Reports | `/library-audit/reports` | Export center, trend charts |
| Audit Settings | `/library-audit/settings` | Rules manager (admin) — mirrors Rules Manager page |

### New Audit Wizard (steps)

1. **Context** — Manufacturer (autocomplete), audit type, optional Flow project/program, department/team, notes
2. **Upload** — Manufacturer Chart + OneDrive export (drag-drop); optional batch mode (Audit Queue parity)
3. **Review** — File pairing preview (from `auto_pairing` logic)
4. **Submit** — Creates `audit_run` + `audit_files`, enqueues job, redirect to run detail with live status

### Findings Table (primary working view)

Columns: Severity · Status · Manufacturer · Year · Model · System · Match Status · Confidence · Issue Owner · Task · Actions

Bulk actions: Create tasks, Assign reviewer, Export selection, Dismiss with reason

### Create Tasks From Findings (modal / drawer)

- Multi-select findings → preview task batch
- Default mapping rules applied (see Task Integration)
- Override assignee, project, due date, QA required
- Confirm → creates work_items + `audit_finding_tasks`

### Validation Comparison View

- Select baseline run + re-validation run
- Show delta: compliance %, missing count, resolved findings, remaining issues
- Mirrors `Compare Audits` + `What Changed` pages

---

## Workflow Proposal

### 1. New Audit

User uploads via wizard. Flow captures metadata and files, creates `audit_run` (status: queued), stores files in `library-audit-files`, enqueues `audit_jobs`.

### 2. Audit Processing

Worker executes `execute_audit()` equivalent:
- Reads files from storage
- Runs `audit_engine.run_audit()` with settings snapshot
- Builds executive package
- **Inserts normalized `audit_findings` rows**
- Uploads workbook + PDF to storage
- Updates run summary metrics
- Emits notification: "Audit complete — {manufacturer} {compliance}%"

### 3. Findings Review

Manager filters findings by severity/status/manufacturer. Reviews evidence (match notes, filenames). Can assign for review without creating task.

### 4. Create Tasks From Findings

User selects findings → batch create. Each task linked via `audit_finding_tasks`. Finding status → `task_created`.

### 5. Correction Tracking

Tasks flow through normal Operations / employee workspace. `audit_corrections` tracks parallel status. Files attached via standard task upload. QA submission uses existing QA Center.

### 6. Re-Validation

After corrections, user uploads fresh OneDrive export → new `audit_run` with `prior_run_id` + `audit_type: revalidation`. Comparison engine computes improvement % and remaining open findings.

### 7. Reporting

Audit Dashboard + Executive Dashboard drilldowns + `/reports` integration. Exports remain available (Excel/PDF) from stored artifacts — not regenerated on every view.

---

## Permission Proposal

### New permission strings (proposed)

```
library_audit:view
library_audit:upload
library_audit:run
library_audit:review
library_audit:create_tasks
library_audit:manage_settings
library_audit:export
library_audit:admin
```

### Role matrix

| Action | Admin | Senior Mgr | Manager | Team Lead | Employee | QA Reviewer |
|--------|-------|------------|---------|-----------|----------|-------------|
| View dashboard & runs | ✅ | ✅ | ✅ team | ✅ team | ❌ | ✅ assigned |
| Upload audit files | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Run / queue audits | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Review findings | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Create tasks from findings | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Assign corrections | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Close / dismiss findings | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Export reports | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Change audit settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Scoping:** Managers and team leads see runs/findings for their department/team branch (same pattern as `getScopeMemberIds` / hierarchy resolver).

**Employees:** No audit module access by default; they execute correction **tasks** on `/work` like any other assignment.

**QA reviewers:** Access findings linked to tasks in their QA queue; read-only on audit runs unless also a lead.

---

## Project / Task Integration

### Finding → Task mapping

| Finding field | Flow field | Rule |
|---------------|------------|------|
| `{manufacturer} — {model} {year} — {match_status}` | task title | Auto-generated, editable |
| severity | priority | critical/high → urgent/high; medium → medium; low/info → low |
| manufacturer | workstream (manufacturer row) | Find or create under project |
| year | year_work_item | Parse integer year |
| model + system | task description | Include expected vs actual filename |
| suggested_correction | description appendix | From match notes heuristics |
| match_notes + filenames | description | Full evidence block |
| audit file (workbook row) | — | Reference URL in description |
| audit run id | custom metadata JSON on task | Store in description footer or future custom field |
| qa_required | qa_required flag | true for SI Naming Review, Needs Human Review |
| files_required | files_required | true when correction expects file proof |

### Status linkage

| Finding status | Task status trigger |
|----------------|---------------------|
| open | — |
| task_created | work_item created (assigned) |
| corrected | task → ready_for_qa |
| resolved | task → done + QA pass |
| dismissed | no task or cancel task |

| Task event | Finding update |
|------------|----------------|
| Task completed + QA pass | finding → resolved |
| QA correction needed | finding → in_review |
| Task cancelled | finding → open |

### Program attachment

When audit run linked to `project_id`:
- Summary metrics sync to `project_metric_definitions` (Audit Pass Rate, Open Findings, etc.)
- Manufacturer findings appear on project detail panel (new tab: **Library Audit**)
- Team dashboard pack can scope KPIs to audit programs

---

## KPI / Reporting Proposal

| KPI | Source | Audit Dashboard | Project Detail | Executive | Reports | Team Scorecard |
|-----|--------|-----------------|----------------|-----------|---------|----------------|
| Audit Pass Rate | run.compliance_rate | ✅ | ✅ | ✅ rollup | ✅ | — |
| Library Accuracy % | avg confidence / pass rate | ✅ | ✅ | ✅ | ✅ | — |
| Findings Open | count findings open | ✅ | ✅ | ✅ | ✅ | — |
| Findings Resolved | count resolved | ✅ | ✅ | ✅ | ✅ | — |
| Critical Findings | severity filter | ✅ | ✅ | ✅ | ✅ | — |
| Avg Correction Time | task timestamps | — | ✅ | ✅ | ✅ | ✅ |
| Repeat Issue Rate | same model+status across runs | ✅ | — | ✅ | ✅ | — |
| Manufacturer Accuracy | manufacturer_scores | ✅ | — | ✅ | ✅ | — |
| Validation Coverage | validation_history | ✅ | ✅ | — | ✅ | — |
| QA Approval Rate | qa_reviews on audit tasks | — | ✅ | ✅ | ✅ | ✅ |
| Revalidation Improvement % | validation_history delta | ✅ | ✅ | ✅ | ✅ | — |

**Progressive disclosure:** Executive dashboard shows 3–4 rollup KPIs + drilldown to Library Audit Center. Team-specific KPIs live on team dashboard packs, not global executive clutter.

---

## Migration Plan

### Phase 0 — Discovery ✅ (this document)

Map both apps. No code.

### Phase 1 — Shared Audit Engine (parallel track)

- Extract `audit_engine`, `library_validation_engine`, `executive_intelligence`, writers into `protech-audit-engine` Python package
- Golden-file regression tests from existing Audit Tool outputs (Acura benchmark, sample OEMs)
- Standalone CLI: `run-audit --mc --export --settings`
- Audit Tool desktop app refactored to import package (proves extraction)
- **Flow impact:** none

### Phase 2 — Library Audit Center Shell

- Flow routes + nav registration (`/library-audit/*`)
- Permissions scaffold
- Empty states + `FlowPageShell` pages
- Link from Settings + Help & Docs
- **No processing yet** — manual import of run metadata optional

### Phase 3 — Upload + Audit Runs

- Supabase migration: `audit_runs`, `audit_files`, `audit_jobs`, `audit_settings`
- Storage bucket `library-audit-files`
- New Audit wizard + job queue table
- Python worker MVP (poll `audit_jobs`)
- Run detail page with status polling
- **Audit Tool still usable in parallel**

### Phase 4 — Findings

- Migration: `audit_findings`
- Worker writes normalized findings after run
- Findings table UI + detail drawer
- Basic filters and export

### Phase 5 — Task Creation

- Migration: `audit_finding_tasks`, `audit_corrections`
- Bulk create tasks composer
- Link to Operations + project detail
- Notifications on task create

### Phase 6 — Correction Tracking + QA

- Sync finding ↔ task ↔ QA status
- QA Center badge: "Audit correction"
- Correction tracker page

### Phase 7 — Revalidation + Trends

- `prior_run_id`, validation runs, comparison views
- Manufacturer score history (`audit_manufacturer_scores`)
- Charts on Audit Reports page

### Phase 8 — Executive Reporting

- Executive dashboard KPI strip integration
- Team dashboard pack for SI Library team
- Operating model KPI extensions
- Retire Streamlit app (read-only archive period)

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Matching logic regression | Wrong compliance rates | Golden tests; Phase 1 extraction before Flow wiring |
| Large finding volumes | UI/DB performance | Pagination; bulk insert; archive old runs |
| Python worker ops complexity | Deployment friction | Start with single worker container; job table in Supabase |
| Dual-tool confusion during migration | Users unsure which to use | Clear banner; feature parity checklist before retirement |
| File size limits | Upload failures | Bucket limits; chunked upload; validate before enqueue |
| Scope creep (rebuild all Streamlit pages) | Delayed delivery | Phase pages by operational value, not 1:1 page parity |
| Hierarchy mismatch (audit OEM vs Flow manufacturer) | Broken task placement | Explicit linking + auto-create with confirmation |
| Permission leaks on findings | Data exposure | Team/department scoping on all audit queries |

---

## Recommended First Build Phase

**Start Phase 2 + Phase 3 together after Phase 1 reaches golden-test parity:**

1. User can upload MC + OneDrive in Flow
2. Job runs real audit engine
3. Run summary + downloadable Excel/PDF appear
4. Findings stored but **read-only table** (Phase 4 fast-follow)

This delivers immediate value (centralized audits + artifacts) before task integration complexity.

**Do not start with:** iframe, Streamlit embed, full TypeScript port, or executive dashboard KPIs.

---

## What Not To Do

| Don't | Why |
|-------|-----|
| Iframe the Streamlit app | No shared auth, bad UX, doesn't integrate with tasks/QA |
| Copy-paste Streamlit pages into React | Wrong paradigm; duplicate maintenance |
| Store audit results only in Excel on disk | Findings won't become tasks; no accountability |
| Rewrite matching logic in TypeScript on day one | High regression risk |
| Create disconnected audit tables with no FK to projects/tasks | Reporting silo |
| Force every audit onto a Flow project on upload | Blocks ad hoc audits; make project optional |
| Show all audit KPIs on executive dashboard | Clutter; use drilldown |
| Big-bang retire Audit Tool before parity | Operations disruption |
| Run pandas in Next.js serverless functions | Timeout/memory limits; use worker |
| Duplicate manufacturer/project models | Link to existing Flow entities |

---

## Appendix A — Audit Tool Module Inventory (reuse vs rewrite)

| Module | Action |
|--------|--------|
| `audit_engine.py` | **Reuse verbatim** in Python package |
| `library_validation_engine.py` | **Reuse verbatim** |
| `executive_intelligence.py` | **Reuse verbatim** |
| `excel_writer.py`, `pdf_writer.py`, `library_validation_export.py` | **Reuse** in worker |
| `auto_pairing.py` | **Reuse** |
| `audit_runner.py` | **Adapt** — swap SQLite save for Supabase callback |
| `audit_repository.py` | **Replace** with Flow DB layer |
| `audit_data_cache.py` | **Rewrite** — cache from Supabase/materialized view |
| `app.py`, `pages/*`, `qol_ui.py`, `styles.py` | **Retire** — Flow React UI |
| `library_score_store.py` | **Merge** into `audit_manufacturer_scores` |
| Streamlit `session_state` | **Eliminate** — server state in Supabase |

---

## Appendix B — Flow Components to Reuse

| Component | Use in Library Audit Center |
|-----------|----------------------------|
| `FlowPageShell` | All pages |
| `KpiStrip` / `MetricCard` | Dashboard |
| `FilterToolbar` | Findings/runs filters |
| `DetailDrawer` | Finding detail |
| `CreateTaskComposer` patterns | Task batch creation |
| `WizardDialog` / `WizardStepper` | New Audit wizard |
| `OperationalPostureStrip` | Critical findings banner |
| `EmptyState` | Zero runs state |
| File upload patterns from `/files` | Audit file upload |
| Notification producers | Audit complete, critical finding |
| `writeAuditLog()` | All mutations |
| `SERVICE_INFORMATION_MODEL` | Default operating model for SI audit team |

---

## Appendix C — Key Architecture Questions (Answers)

| Question | Answer |
|----------|--------|
| Should Audit Tool become a native Flow module? | **Yes — UI and workflows native; engine isolated** |
| Should processing engine remain isolated? | **Yes — Python package + worker** |
| Which parts reused? | audit_engine, validation, executive intelligence, exporters, auto_pairing |
| Which parts rewritten? | All UI, SQLite repository, Streamlit state, cache layer, Flow integration glue |
| Which Flow components reused? | Platform shell, task/QA/files/notifications/permissions patterns |
| What data in Supabase? | All entities in Data Model section |
| What files in Flow storage? | Uploads + generated artifacts in `library-audit-files` |
| How findings become tasks? | Explicit bulk create via bridge table with mapping rules |
| How results attach to projects? | Optional `project_id` on audit_run; metrics sync |
| How KPIs roll into dashboards? | Progressive — audit center → project tab → executive drilldown |
| How QA connects? | Standard task QA; finding resolves on QA pass |
| How permissions work? | New `library_audit:*` permissions + team scoping |
| Key risks? | See Risks section |

---

## Final Goal Alignment

| Goal | How this architecture achieves it |
|------|-------------------------------------|
| Flow = platform | Single auth, nav, tasks, QA, reporting |
| Audit Tool = intelligence engine | Python engines preserved, not reimplemented |
| Audits → operational work | Findings entity + task bridge + QA linkage |
| Not just reports | Normalized findings drive tasks, KPIs, accountability |
| No breaking changes | Audit Tool runs until parity; Flow SI features untouched |

---

*Next step when approved: Phase 1 extraction spec + Phase 2/3 technical design (worker contract, API shapes, migration SQL draft for review only).*
