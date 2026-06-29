# Flow Team Lead Guide

**Role:** `teamlead`  
**Default home:** `/operations`  
**Scope:** Team branch — direct reports and team members in hierarchy

---

## Your Role in Flow

Team Leads are **front-line supervisors**. You run the Operations board daily, keep work assigned, process QA, review wrap-ups, and respond to alerts — all within your team scope.

You do **not** have Executive Dashboard, Project Health, Settings, or org-wide reports access.

---

## What You Can Access

| Module | Route | Notes |
|--------|-------|-------|
| Operations | `/operations` | Primary workspace |
| Projects | `/projects` | Create/edit (no delete) |
| Templates | `/operations/templates` | Template library |
| QA Center | `/qa-center` | Review + QA reports |
| People | `/people` | Team roster |
| Org Chart | `/org-chart` | Team context |
| Alert Center | `/alert-center` | Team alerts |
| Wrap-ups | `/wrap-ups` | Team daily reports |
| Time Clock | `/time-clock` | Team punches |
| Production | `/production` | Team output |
| Planning | `/planning` | Team capacity |
| Reports | `/reports` | Nav labeled "Team Reports" |
| Analytics | `/analytics` | Nav labeled "Analytics" (team) |
| Work Visibility | `/reports/work-visibility` | Compliance |
| Team dashboard | `/teams/[slug]` | When granted access |
| Files | `/files` | Company docs (view) |

**Not accessible:** Executive Dashboard, Project Health, Settings, Innovation Hub manage, Performance page, Files upload (no `company_documents:manage`)

---

## Permissions Summary

| Capability | Permission |
|------------|------------|
| View team work | `work:view_team` |
| Assign / edit tasks | `work:assign`, `work:edit` |
| Create / edit projects | `projects:create`, `projects:edit` |
| QA review | `qa:review`, `qa:view` |
| Team + QA reports | `reports:view_team`, `reports:view_qa` |
| Team people | `people:view_team` |
| Submit innovation ideas | `innovation_hub:submit` |

---

## Your Daily Checklist

- [ ] Open **Operations** — clear stuck/unassigned items
- [ ] Check team **dashboard** if your team has one (sidebar link)
- [ ] Check **Alert Center** — help flags first, then workload alerts
- [ ] Process **QA Center** queue
- [ ] Verify team **clocked in** on Time Clock
- [ ] Review **Wrap-ups** before end of shift
- [ ] Assign next-day work before leaving

---

## Operations Board Guide

### Board Structure

Tree: **Project → Work package → Phase → Task cards**

Labels vary by team (Manufacturer/Year, Workstream/Milestone, etc.) — see [Creating Work](/docs/creating-work).

### Filters
- Department dropdown
- Status view (all, by column)
- Search by title

### Card Actions
- Open detail
- Change status
- Assign/reassign
- Edit priority and due date
- Submit to QA (on behalf of team if needed)
- Add comment

### New Work
Click **New Work**:
- **New Task** — most common for leads (quick assignment)
- **New Project** — when starting a new program (7-step wizard)
- **New Board** — lightweight queue (rare)

**Full step-by-step guide:** [Creating Projects & Tasks](/docs/creating-work)

---

## QA for Team Leads

Many team leads perform QA review:

1. `/qa-center` → select item
2. Review uploaded files
3. Pass or correction with notes + error category
4. Employee sees return on `/work/[id]`

**QA reports** available via your team reports scope (`reports:view_qa`).

---

## Wrap-Up Supervision

**Route:** `/wrap-ups`

For each team member submission:
1. Read completed summary and blockers
2. Check unassigned minutes — ask for better task tracking if chronic
3. Mark **Reviewed**
4. Set **Follow-up needed** if action required tomorrow
5. Use **Override** only when employee had legitimate reason to skip (documents reason)

Missing wrap-ups appear in Alert Center and Time Clock compliance view.

---

## Alert Center Response Guide

| Alert Type | Your Response |
|------------|---------------|
| **Help flag — stuck** | Contact employee; reassign or unblock task |
| **Help flag — training** | Schedule support; adjust assignment |
| **Workload alert — low hours** | Assign next task from queue |
| **Workload alert — almost done** | Pre-assign follow-up work |
| **Activity gap** | Coach on task timer usage |
| **Wrap-up gap** | Ensure employee submits before leaving |

Actions: Acknowledge, Resolve, Dismiss, Snooze (workload alerts).

---

## Time Clock

Monitor:
- Who is on shift vs late
- Lunch status
- Wrap-up compliance column

Edit punches only with valid reason (system requires `edit_reason`).

---

## Projects (Team Lead)

You can create and edit projects but **not delete**.

Use Projects page when:
- Starting multi-task programs
- Monitoring team KPI strip (At Risk, Ready for QA)
- Adding tasks under existing workstreams

Project detail opens in side sheet — no separate project URL.

---

## Team Reports

Sidebar shows **Team Reports** and **Analytics** — both scoped to your branch.

Key metrics:
- Productivity by team member
- Overdue / stuck counts
- QA pass rate
- Work visibility compliance

Use in daily huddles and weekly manager syncs.

---

## What to Escalate to Manager

- Cross-team resource conflicts
- Project delete or archive decisions
- Repeated QA failures requiring coaching plan
- Employee role or access issues (admin only)
- Platform configuration needs

---

## Tips for Effective Lead Operations

1. **Assign before end of day** — workload alerts fire when employees run low on hours.
2. **Don't let QA queue age** — blocks employee progression and scorecards.
3. **Watch correction patterns** — 3+ corrections with low pass rate triggers executive attention.
4. **Use Planning** when team is at capacity — don't over-assign blindly.
5. **Org Chart** for quick "who is working on what" without opening each profile.

---

*Manager guide: [MANAGER_GUIDE.md](./MANAGER_GUIDE.md) · Employee guide: [EMPLOYEE_GUIDE.md](./EMPLOYEE_GUIDE.md)*
