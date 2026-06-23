# Flow Senior Manager Guide

**Role:** `senior_manager`  
**Default home:** `/operations`  
**Scope:** Organization-wide visibility (same branch rules as admin for most modules)

---

## Your Role in Flow

Senior Managers operate at **executive operations level** — full org visibility into delivery, workforce, and outcomes without platform administration (no Users or Settings access).

You create and steer **projects**, monitor **portfolio risk**, use **org-wide reports**, and triage **Innovation Hub** submissions.

---

## What You Can Access

| Module | Route | Access |
|--------|-------|--------|
| Executive Dashboard | `/executive` | Full |
| Operations | `/operations` | Org-wide work |
| Projects | `/projects` | Create, edit (no delete) |
| Project Health | `/project-health` | Full portfolio |
| Planning & Forecasting | `/planning` | Capacity snapshot |
| Reports | `/reports` | Org-wide |
| Analytics | `/analytics` | Org-wide |
| Production | `/production` | Org-wide |
| Org Chart | `/org-chart` | Full |
| Alert Center | `/alert-center` | Org-wide |
| Wrap-ups | `/wrap-ups` | Org-wide review |
| Time Clock | `/time-clock` | Team availability |
| QA Center | `/qa-center` | Review permission* |
| Files | `/files` | View + manage company docs |
| Innovation Hub | `/innovation-hub` | Triage submissions |
| Templates | `/operations/templates` | Template library |

**Not accessible:** `/settings/*`, `/settings/users`, `/system-health`

**Known issue:** `/people` appears in navigation but **senior_manager is excluded from route allowlist** — you may get unauthorized when visiting People directly. Use **Org Chart** (`/org-chart`) or ask an admin to fix allowlist alignment.

*Super Admin note: QA route allowlist excludes super_admin despite permissions — senior_manager should have access.

---

## What You Can Do

| Action | Permission |
|--------|------------|
| Create / edit projects | `projects:create`, `projects:edit` |
| View all work | `work:view_all` |
| Assign / edit tasks | `work:assign`, `work:edit` |
| QA review | `qa:review` |
| Org-wide reports | `reports:view_all` |
| View all people data | `people:view_all` |
| Manage company documents | `company_documents:manage` |
| Innovation hub triage | `innovation_hub:manage` |
| View users (read) | `users:view` |

**Cannot:** Delete projects, manage users, change platform settings, manage departments.

---

## Daily Workflow

1. **Executive Dashboard** — Scan department health, delivery risk, QA posture, attention list.
2. **Alert Center** — Resolve org-wide escalations (help flags, workload, wrap-up gaps).
3. **Projects KPI strip** — Click **At Risk** or **Forecasted Late** filters; open project detail sheets.
4. **Project Health** — Review projected completion vs committed dates.
5. **Planning** — Check capacity and at-risk tasks across departments.
6. **Wrap-ups** — Spot-check daily report compliance org-wide.

---

## Project Management

### Creating Projects

Use **New Work → New Project** (7-step wizard):

1. Project basics
2. Department & team
3. Template (seeds workstreams, phases, tasks, metrics)
4. Forecasting inputs
5. Custom metrics preview
6. QA & file requirements preview
7. Review and create

### Portfolio KPIs

| KPI | Action When Elevated |
|-----|---------------------|
| At Risk | Open projects; verify estimates and assignments |
| Due This Week | Prioritize completion or escalate resources |
| Ready For QA | Ensure QA reviewers are clearing queue |
| Forecasted Late | Reconcile due dates vs capacity in Planning |
| Missing Estimates | Add document counts on projects/tasks |

### Custom Metrics

Projects support per-program custom metrics (definitions + values). Executive Dashboard rolls up **outcome metrics** across portfolio. Export via Reports.

---

## Reporting for Leadership

**Reports (`/reports`):**
- Productivity by analyst
- QA pass rates
- Forecast risk
- Workload and help flag summaries
- Department reports
- Project outcome metrics (CSV export)

**Analytics (`/analytics`):**
- Cross-module trends: tasks, forecast, QA, wrap-ups, visibility

**Performance (`/performance`):**
- Deep-link from Reports/People — accountability and coaching views (no sidebar entry)

Use these for standups, executive briefings, and capacity planning.

---

## Innovation Hub

Review and triage employee submissions:
- Ideas
- Bug reports
- Feature requests

Route: `/innovation-hub`

---

## Escalation Playbook

| Signal | Source | Response |
|--------|--------|----------|
| Department health score low | Executive Dashboard | Drill to Operations + People |
| Delivery risk elevated | Executive / Project Health | Planning review; reassign capacity |
| QA queue backlog | Executive / QA Center | Assign QA reviewers; unblock corrections |
| Wrap-up compliance low | Executive / Time Clock | Manager coaching; verify hourly staff |
| Help flags critical | Alert Center | Direct manager engagement same day |

---

## Best Practices

1. Start each day on **Executive Dashboard**, not Operations — get context before diving into tasks.
2. Use **Project Health** for portfolio reviews; use **Operations** for task-level intervention.
3. Filter Projects by **At Risk** weekly — don't wait for due dates to slip.
4. Pair **Planning** capacity view with **Production** output reports.
5. Export custom metrics from Reports for external stakeholder updates.

---

*Manager-level team operations: [MANAGER_GUIDE.md](./MANAGER_GUIDE.md) · Full manual: [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md)*
