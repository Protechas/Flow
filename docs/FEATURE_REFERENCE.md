# Flow Feature Reference

Master inventory of pages, modules, routes, permissions, alerts, and workflows.

**Source:** `flow/src` codebase  
**Last aligned:** Current production release

---

## Roles

| Role ID | Label | Default Route |
|---------|-------|---------------|
| `super_admin` | Super Admin | `/operations` |
| `admin` | Administrator | `/operations` |
| `senior_manager` | Senior Manager | `/operations` |
| `manager` | Manager | `/operations` |
| `teamlead` | Team Lead | `/operations` |
| `employee` | Employee | `/work` |
| `viewer` | Viewer | `/executive` |

**Legacy aliases:** `analyst` → employee, `qa` → teamlead

---

## Permission Strings (26)

```
users:manage          users:view
projects:create       projects:edit       projects:delete
work:view_all         work:view_team      work:view_own
work:assign           work:edit           work:edit_own       work:delete
work:submit_qa
time:log              time:log_own
comments:create       files:create
company_documents:view    company_documents:manage
qa:review             qa:view             corrections:create
reports:view_all      reports:view_team   reports:view_qa     reports:view_own
people:view_all       people:view_team    people:view_own
settings:manage       departments:manage  departments:view
dashboard:view
innovation_hub:submit innovation_hub:manage
```

---

## Route Inventory

### Public & Auth

| Route | Type | Purpose |
|-------|------|---------|
| `/` | Redirect | Role default or `/login` |
| `/login` | Page | Sign in |
| `/auth/callback` | API | OAuth/magic link |
| `/auth/signup` | Page | Employee registration |
| `/auth/forgot-password` | Page | Reset request |
| `/auth/reset-password` | Page | Set password |
| `/unauthorized` | Page | Access denied |

### Management `(app)`

| Route | Nav Label | Group |
|-------|-----------|-------|
| `/executive` | Executive Dashboard | Dashboard |
| `/alert-center` | Alert Center | Attention |
| `/qa-center` | QA Review | Attention |
| `/wrap-ups` | Daily Reports | Attention |
| `/operations` | Operations | Operations |
| `/operations/templates` | Templates | Administration |
| `/projects` | Projects | Operations |
| `/production` | Production | Operations |
| `/project-health` | Project Health | Operations |
| `/files` | Files | Operations |
| `/files/view/[source]/[id]` | — | Document viewer |
| `/people` | People | Workforce |
| `/people/[id]` | — | Profile |
| `/org-chart` | Org Chart | Workforce |
| `/time-clock` | Time Clock | Workforce |
| `/reports` | Reports / Team Reports | Reporting |
| `/reports/work-visibility` | — | Compliance report |
| `/analytics` | Analytics | Reporting |
| `/planning` | Planning & Forecasting | Reporting |
| `/performance` | — | Performance hub (no nav) |
| `/notifications` | — | Header bell |
| `/settings` | Settings | Administration |
| `/settings/users` | Users | Administration |
| `/settings/departments` | Departments | Administration |
| `/settings/forecasting` | — | Hub link only |
| `/settings/workload-alerts` | — | Hub link only |
| `/settings/work-visibility` | — | Hub link only |
| `/settings/help-flags` | — | Hub link only |
| `/settings/team-dashboards` | Team dashboards | Administration |
| `/settings/team-dashboards/new` | — | Create dashboard pack |
| `/settings/team-dashboards/[slug]` | — | Edit dashboard pack |
| `/settings/operating-models` | Operating models | Administration |
| `/settings/operating-models/new` | — | Create operating model |
| `/settings/operating-models/[slug]` | — | Edit operating model |
| `/teams/[slug]` | Team dashboard (dynamic) | Operations / Reporting |
| `/docs` | Help & Docs | Reporting |
| `/docs/[slug]` | — | Documentation article |
| `/system-health` | System Health | Administration |
| `/innovation-hub` | Innovation Hub | Administration |

### Redirect Routes

| Route | Target |
|-------|--------|
| `/dashboard` | `/executive` |
| `/work-tracker` | `/operations` |
| `/team` | `/people` |
| `/team/[id]` | `/people/[id]` |

### Employee `(employee)`

| Route | Nav Label |
|-------|-----------|
| `/work` | Workspace |
| `/work/[id]` | Task workspace |
| `/work/files` | Files & SOPs |
| `/work/files/view/[source]/[id]` | Document viewer |
| `/scorecard` | My Scorecard |

---

## Navigation Configuration

**Group order:** Dashboard → Attention → Operations → Workforce → Reporting → Administration

**Primary emphasis items:** Executive Dashboard, Alert Center, Operations

**Employee nav:** Separate from sidebar (`EMPLOYEE_NAV`)

**Viewer nav:** Executive Dashboard only in dedicated viewer nav; full viewer allowlist includes more routes

---

## Modules

| Module | Routes | Key Components |
|--------|--------|----------------|
| Executive Dashboard | `/executive` | `executive-dashboard-view.tsx` |
| Alert Center | `/alert-center` | Alert panels per engine |
| Operations | `/operations` | Operations tree/kanban |
| Projects | `/projects` | `project-workspace.tsx`, `project-portfolio-detail-panel.tsx` |
| Project Health | `/project-health` | Health list + export |
| Planning | `/planning` | Planning center snapshot |
| QA | `/qa-center` | QA queue + review form |
| People | `/people` | Roster + profile |
| Org Chart | `/org-chart` | `org-chart-view.tsx` |
| Production | `/production` | Production reports |
| Time Clock | `/time-clock` | Team availability |
| Wrap-ups | `/wrap-ups` | Manager review list |
| Reports | `/reports` | Report metrics panels |
| Analytics | `/analytics` | Cross-module analytics |
| Files | `/files`, `/work/files` | Document lists + viewer |
| Employee Workspace | `/work` | `employee-workspace-view.tsx` |
| Settings | `/settings/*` | Admin config pages |
| System Health | `/system-health` | Integrity report |
| Innovation Hub | `/innovation-hub` | Feedback triage |
| Templates | `/operations/templates` | Enterprise template library |
| Team dashboards | `/teams/[slug]`, `/settings/team-dashboards` | `team-dashboard-view.tsx`, builder admin |
| Operating models | `/settings/operating-models` | Per-team labels, KPIs, tracking config |
| Custom Metrics | Embedded in projects/reports | `project-metrics-panel.tsx` |
| Help & Docs | `/docs`, `/docs/[slug]` | In-app markdown documentation |

---

## Workflows

| Workflow | Trigger | End State |
|----------|---------|-----------|
| Project creation (program builder) | New Program | Project + structure/matrix from blueprint |
| Board creation | New Work → Board or New Board | `project_type: board` |
| Quick task | New Work → Task | WorkPackage (+ optional auto hierarchy) |
| Team dashboard work creation | `/teams/[slug]` header | Program/task scoped to team operating model |
| Task assignment | Set assigned_to | Status assigned |
| Task production | Start timer, upload files | Working on it |
| QA submit | Employee/manager submit | ready_for_qa |
| QA review | Reviewer decision | done or correction_needed |
| Correction rework | Employee fixes | Resubmit to QA |
| Help flag | Employee escalation | Alert Center item |
| Workload alert | Engine threshold | Alert Center item |
| Activity gap | Visibility engine | Alert Center item |
| Wrap-up submit | Employee end of day | Compliance record |
| Wrap-up review | Manager marks reviewed | Acknowledged |
| Clock in/out | Employee shift | TimeClockEntry |
| User creation | Admin wizard | Supabase user + profile |
| Org seat assignment | Admin/org chart | Position filled |

---

## Work Package Statuses

```
not_started | assigned | working_on_it | stuck | waiting
ready_for_qa | in_qa | correction_needed | done
```

---

## QA Results

```
pass | minor_correction | major_correction | rejected
```

---

## Alert Types

| Type | Source Engine | Config Page |
|------|---------------|-------------|
| Help flags | `help-flags/engine.ts` | `/settings/help-flags` |
| Workload alerts | `workload-alerts/engine.ts` | `/settings/workload-alerts` |
| Activity gaps | `work-visibility/engine.ts` | `/settings/work-visibility` |
| Wrap-up gaps | `wrap-up/compliance.ts` | `/settings/work-visibility` (clock-out gate) |
| Overdue work count | Scoring module | — |

---

## Reports & Exports

| Output | Location | Format |
|--------|----------|--------|
| Report metrics | `/reports` | In-app panels |
| Analytics trends | `/analytics` | In-app charts/tables |
| Work visibility | `/reports/work-visibility` | Compliance tables |
| Project custom metrics | Reports, Analytics, Project Health | CSV export |
| Executive outcome metrics | `/executive` | KPI rollup |

---

## Settings Inventory

| Page | Settings |
|------|----------|
| `/settings/forecasting` | minutes_per_document, productive_hours_per_day, working_days |
| `/settings/workload-alerts` | enabled, threshold_hours, snooze_hours, dept/team scope |
| `/settings/work-visibility` | tracking enabled, alerts enabled, gap threshold, compliance target, capacity threshold, wrap-up required |
| `/settings/help-flags` | idle escalation thresholds, enable toggles |
| `/settings/team-dashboards` | Dashboard packs — scope, KPIs, nav, access (JSONB) |
| `/settings/operating-models` | Per-team labels, KPIs, tracking, forecast rules |
| `/settings/users` | User IAM (not platform toggles) |
| `/settings/departments` | Org structure |

---

## Integrations

| System | Purpose |
|--------|---------|
| Supabase Auth | Login, invites, password reset |
| Supabase PostgreSQL | Persistent data |
| Supabase Storage | File storage |
| Vercel | Hosting |

---

## Major Component Directories

```
src/components/
  employee/       — Employee workspace
  executive/      — Executive dashboard
  operations/     — Operations board
  projects/       — Project portfolio
  hierarchy/      — Org chart
  settings/       — User/dept admin
  work-creation/  — New work wizard
  forecast/       — Planning UI
  qa-center/      — QA review
  reports/        — Reporting panels
  team-dashboards/ — Team dashboard views and builder
  operating-models/ — Operating model admin and wizard
  docs/             — In-app Help & Docs rendering
  performance/    — Scorecards
  files/          — Document management
```

---

## Server Actions Index

| File | Actions |
|------|---------|
| `crud.ts` | Project/manufacturer/year/package CRUD, archive, wizard create |
| `qa.ts` | submitQaReviewAction |
| `employee.ts` | submitDailyWrapUpAction, requestWork, etc. |
| `clock.ts` | clockInAction, clockOutAction, editClockEntry |
| `production.ts` | Task timer, uploadTaskFile |
| `users.ts` | User CRUD, invites |
| `departments.ts` | Dept/team CRUD |
| `positions.ts` | Org position CRUD |
| `forecast-settings.ts` | Update forecast defaults |
| `workload-alerts.ts` | Update workload settings |
| `work-visibility-settings.ts` | Update visibility settings |
| `company-documents.ts` | Upload/delete company docs |
| `help-flags.ts` | Help flag lifecycle |
| `wrap-up-review.ts` | Manager wrap-up review |
| `project-metrics.ts` | Custom metric definitions/values |
| `team-dashboard-packs.ts` | Team dashboard CRUD |
| `operating-models.ts` | Operating model CRUD |
| `notifications.ts` | runWorkflowChecksAction |

---

*System architecture: [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)*
