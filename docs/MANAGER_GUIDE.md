# Flow Manager Guide

**Role:** `manager`  
**Default home:** `/operations`  
**Scope:** Team branch — users in your reporting hierarchy

---

## Your Role in Flow

Managers run **team-scoped operations**: assign work, review QA, supervise daily reports, monitor alerts, and maintain project delivery within your branch.

You have broader project permissions than team leads (including **project delete**) but narrower scope than senior managers (team-only work and people views).

---

## What You Can Access

| Module | Route | Scope |
|--------|-------|-------|
| Executive Dashboard | `/executive` | Your branch |
| Operations | `/operations` | Team work |
| Projects | `/projects` | Team projects |
| Project Health | `/project-health` | Team portfolio |
| Planning | `/planning` | Team capacity |
| QA Center | `/qa-center` | Team queue |
| People | `/people` | Team roster |
| Org Chart | `/org-chart` | Full view, team actions |
| Alert Center | `/alert-center` | Team alerts |
| Wrap-ups | `/wrap-ups` | Team daily reports |
| Time Clock | `/time-clock` | Team punches |
| Production | `/production` | Team output |
| Reports | `/reports` | Team reports |
| Analytics | `/analytics` | Team analytics |
| Files | `/files` | Company docs |
| Templates | `/operations/templates` | Template library |
| Work Visibility Report | `/reports/work-visibility` | Team compliance |
| Team dashboard | `/teams/[slug]` | Team-scoped KPIs, programs, work creation |

**Not accessible:** Settings, Users, System Health, Innovation Hub manage (unless granted)

---

## Permissions Summary

| Capability | Permission |
|------------|------------|
| View team work | `work:view_team` |
| Assign / edit / delete tasks | `work:assign`, `work:edit`, `work:delete` |
| Projects CRUD | `projects:create`, `projects:edit`, `projects:delete` |
| QA review | `qa:review` |
| Team reports | `reports:view_team` |
| Team people | `people:view_team` |
| Company doc management | `company_documents:manage` |
| View users | `users:view` |

---

## Daily Manager Routine

### Morning (15 min)
1. **Alert Center** — Clear overnight help flags and workload alerts.
2. **Operations** — Scan stuck and unassigned columns.
3. **QA Center** — Check queue depth.

### Midday
4. **Assign** new or returned work from Operations or Projects.
5. **Time Clock** — Verify team is clocked in (hourly staff).

### End of Day (15 min)
6. **Wrap-ups** — Review team daily reports; flag follow-ups.
7. **Operations** — Confirm no critical overdue items left unassigned.

---

## Assigning Work

**Step-by-step manual:** [Creating Projects & Tasks](/docs/creating-work) — covers New Work wizard, project creation (7 steps), quick tasks, and adding tasks from Operations or Projects.

### From Operations
1. Open package card or detail panel.
2. Set **Assigned To** to team member.
3. Set status to **Assigned** or **Working On It**.
4. Confirm due date and document estimates for forecast accuracy.

### From Projects
1. Open project in portfolio detail sheet.
2. Navigate workstream → year/phase.
3. **Add Task** — confirm Task Impact Review if forecast changes.

### Quick Task
**New Work → New Task** — fastest path for one-off assignments. System may auto-create hierarchy nodes.

---

## QA Management

1. Open **QA Center**.
2. Select queue item — review files and submission notes.
3. Decision:
   - **Pass** → task complete
   - **Minor / Major Correction** → returns to employee with notes
   - **Rejected** → significant rework required
4. Add error category and notes for reporting.

Track team QA pass rate on Reports and individual scorecards on People profiles.

---

## Wrap-Up Review

**Route:** `/wrap-ups`

| Action | When |
|--------|------|
| Mark reviewed | Standard acknowledgment |
| Internal notes | Manager-only context |
| Follow-up needed | Requires next-day action |
| Override requirement | Employee couldn't submit — use sparingly with reason |

Watch for:
- High unassigned minutes
- Needs support flags
- Low task tracking compliance %

---

## Time Clock Management

**Route:** `/time-clock`

- View team availability (on shift, lunch, off)
- See wrap-up compliance alongside punches
- **Edit clock entries** (requires `work:assign`) — always provide edit reason

---

## Project Ownership

As manager you can **delete projects** (team leads cannot).

Before deleting:
- Confirm no active tasks employees are working
- Archive preferred over delete when history matters

Use **Project Health** for weekly portfolio review with your team leads.

---

## People Management (Non-Admin)

You **view** team members on `/people` but **cannot** change roles or create users — that's admin on `/settings/users`.

From People profiles you can:
- View scorecard and queue
- See workload alerts and help flags
- Navigate to active tasks

For org changes (promotions, team moves), request admin action.

---

## Reports You Should Use

| Report | Purpose |
|--------|---------|
| Team productivity | Output by analyst |
| QA pass rate | Quality trends |
| Forecast risk | Upcoming slips |
| Work visibility | Time compliance |
| Workload alerts | Capacity issues |
| Accountability | Coaching candidates |

**Analytics** combines cross-module trends for weekly team meetings.

---

## Team Dashboards

If your team has a custom dashboard (sidebar link or `/teams/{slug}`):

1. **Morning** — scan team KPIs (health, at-risk, open tasks).
2. **Create work** from the dashboard header — New Program and New Work are pre-scoped to your team.
3. **Drill into programs** — portfolio cards link to Ops, Health, and quick **Add task**.
4. Labels and fields follow your team's **operating model** (e.g. Workstream/Milestone instead of Manufacturer/Year).

Ask an admin to configure dashboards at **Settings → Team dashboards** and operating models at **Settings → Operating models**.

**Guide:** [Team Dashboards](/docs/team-dashboards)

---

## Escalation to Admin

Contact administrator when:
- User needs creation, role change, or deactivation
- Department/team structure change required
- Platform settings need adjustment (forecast, alerts)
- System Health issues affect your team
- Senior manager needed for org-wide resource decisions

---

*Team Lead operations detail: [TEAM_LEAD_GUIDE.md](./TEAM_LEAD_GUIDE.md) · Full manual: [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md)*
