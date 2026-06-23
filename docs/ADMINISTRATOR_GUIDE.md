# Flow Administrator Guide

**Roles:** `admin`, `super_admin`  
**Default home:** `/operations`  
**Primary admin routes:** `/settings/*`, `/system-health`

---

## Administrator Responsibilities

Administrators own:

1. **Identity & access** — users, roles, account lifecycle
2. **Org structure** — departments, teams, org chart seats
3. **Platform configuration** — forecasting, alerts, visibility rules
4. **Data integrity** — system health monitoring and remediation
5. **Company documents** — SOPs and reference file management

---

## Access Matrix

| Route | Permission | Notes |
|-------|------------|-------|
| `/settings` | `settings:manage` | Hub — profile, theme, platform links |
| `/settings/users` | `users:manage` | Full IAM |
| `/settings/departments` | `departments:manage` | Dept/team CRUD |
| `/settings/forecasting` | `settings:manage` | Not in sidebar — via Settings hub |
| `/settings/workload-alerts` | `settings:manage` | Via Settings hub |
| `/settings/work-visibility` | `settings:manage` | Via Settings hub |
| `/system-health` | `settings:manage` | Sidebar + Settings hub |

Non-admins are redirected to `/unauthorized` for all `/settings/*` routes.

---

## User Management (`/settings/users`)

### Create a User

**Prerequisites for Supabase production:**
- `SUPABASE_SERVICE_ROLE_KEY` configured
- Without it: wizard and bulk invite are hidden; password actions limited

**Methods:**

1. **User Setup Wizard** — Step-by-step: name, email, role, department, team, supervisor, pay type, org seat.
2. **Bulk Employee Invites** — Paste multiple emails; creates employee-role accounts.
3. **Manual table edit** — Edit button on any row.

### User Profile Fields

| Field | Impact |
|-------|--------|
| Role | Entire permission set (see OPERATIONS_MANUAL Section 2) |
| Pay type | Hourly = shift clock + wrap-up required; Salary = optional clock |
| Department / Team | Scoping for managers and alert engines |
| Supervisor | Reporting hierarchy |
| Org position | Seat on org chart; syncs dept/team |
| Employment status | Active vs inactive login |
| Account enabled | Hard block on sign-in when disabled |

### Password & Invite Actions

- **Set password** — Direct set (service role required)
- **Resend invite** — Supabase invite email
- **Send reset email** — Password reset flow

### Users Needing Setup

Queue surfaces users missing department, team, or supervisor. Resolve before they appear correctly in scoped views.

### Unassigned Org Seats Panel

Assign users who exist but have no org chart seat.

### Audit Log

Last 50 actions: user changes, profile edits, org mutations.  
**Supabase:** persisted in `audit_log` table.  
**Demo:** in-memory only (lost on restart).

**Gap:** Platform setting changes (forecast, alerts, visibility) are **not** audit-logged.

---

## Department Management (`/settings/departments`)

### Structure Wizard

Creates department shell + teams + optional team leads in guided steps.

### Structure View

Visual tree with vacant leadership slots highlighted.

### CRUD Operations

- Create / rename department
- Archive / delete (with confirmation)
- Assign department lead
- Manage teams within department

### Unassigned Department Users

Panel to assign users with no `department_id`.

---

## Platform Settings

### Forecasting (`/settings/forecasting`)

| Setting | Purpose | Recommended |
|---------|---------|-------------|
| Minutes per document | Base time per document for due-date math | Measure from production averages |
| Productive hours per day | Daily capacity for projections | 6.0–7.0 |
| Working days | Days counted in forecast | Mon–Fri minimum |

**On save:** Recalculates forecasts across Operations, Projects, Reports.  
**Persistence:** Supabase `forecast_settings` table or HTTP cookie (demo).

### Workload Alerts (`/settings/workload-alerts`)

| Setting | Purpose |
|---------|---------|
| Enable workload alerts | Master toggle |
| Work remaining threshold (hours) | Triggers low-capacity warnings |
| Snooze duration (hours) | Default alert snooze |
| Department / team scope | Empty = all; checkboxes limit scope |

**Persistence:** Supabase `workload_alert_settings` or cookie.

### Work Visibility (`/settings/work-visibility`)

| Setting | Purpose |
|---------|---------|
| Enable work visibility tracking | Metrics engine master toggle |
| Enable work visibility alerts | Alert Center activity gaps |
| Activity gap threshold (minutes) | Undocumented time trigger |
| Task tracking compliance target (%) | Report KPI target |
| Capacity alert threshold (%) | Capacity warnings |
| Daily report required for clock-out | Wrap-up gate for hourly employees |

**Persistence:** Cookie only — **not shared org-wide in Supabase production.** Multi-admin environments should treat this as a known limitation until Supabase persistence is added.

### Help Flag Settings (Not Yet in UI)

Database table `help_flag_settings` exists. Escalation thresholds (30/60 min critical idle) are hardcoded defaults. No admin page exists — see SYSTEM_HEALTH_AUDIT.

---

## System Health (`/system-health`)

Read-only dashboard running `buildSystemHealthReport()` across 18 issue categories:

| Category | Examples |
|----------|----------|
| Assignments | Employees without team; unassigned active tasks |
| Relationships | Missing/invalid managers, teams, departments |
| Forecast | Missing due dates; weak forecast inputs |
| Alerts | Orphan workload alerts, help flags, task links |
| Records | Orphan wrap-ups; empty active projects |
| Org chart | Orphan positions; duplicate seats; circular hierarchy; vacant leadership |

Each issue has severity and a **Review** link.  
**Note:** "Incomplete forecast inputs" links to `/settings/forecasting` (company defaults) rather than individual tasks — manually navigate to `/operations` or `/planning` to fix task-level estimates.

---

## Org Chart Administration

**Route:** `/org-chart` (also manageable via Users page seat assignment)

**Actions:**
- Create / move / archive positions
- Assign users to seats
- Bootstrap department org structure (generates default positions)

Seat assignment syncs user department, team, and supervisor fields.

---

## Company Documents

**Route:** `/files`

Requires `company_documents:manage` (admins have this).

- Upload SOPs, policies, references
- Categories: sop, policy, reference, other
- Employees access read-only via `/work/files`

**Storage:** Supabase storage in production; demo in-memory.

---

## Innovation Hub (`/innovation-hub`)

Triage employee-submitted ideas, bugs, and feature requests. Requires `innovation_hub:manage`.

---

## Demo Mode Administration

When Supabase is not configured:

- Data source badge shows "Demo in-memory"
- **Role switcher** on Settings page tests permissions without separate accounts
- Audit log is ephemeral
- Forecast/workload settings persist in cookies per browser

---

## Deployment & Environment

**Production:** Vercel deployment at https://flowproduction.space  
**Database:** Supabase project (migrations in `supabase/migrations/`)

**Apply pending migrations:**
```bash
npm run migrate:pending
```

Key migrations:
- `026_user_profile_fields.sql` — extended user profile
- `027_project_custom_metrics.sql` — custom project metrics

---

## Admin Best Practices

1. **Complete user setup before first login** — department, team, supervisor, seat.
2. **Run System Health weekly** — fix critical issues first.
3. **Calibrate forecasting** after observing actual production rates for 2–4 weeks.
4. **Document work visibility settings** externally until Supabase persistence exists.
5. **Use audit log** for user/org change investigations.
6. **Do not self-edit profile on Settings** — use another admin to edit your user record.

---

## Admin Troubleshooting Quick Reference

| Symptom | Action |
|---------|--------|
| User wizard missing | Configure `SUPABASE_SERVICE_ROLE_KEY` |
| User sees wrong data | Verify department, team, supervisor, role |
| Forecasts all wrong | Reset forecasting settings; check task document counts |
| Alerts not firing | Enable toggles; check department scope on workload settings |
| Settings not shared | Work visibility is cookie-only — document centrally |
| Senior manager blocked on People | Known allowlist gap — use Org Chart or fix permissions |

Full troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

*For complete module reference, see [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md). For architecture details, see [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md).*
