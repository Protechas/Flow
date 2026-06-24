# Flow Quick Start Guide

**Audience:** New users on day one  
**Time to complete:** 30–60 minutes depending on role  
**Production URL:** https://flowproduction.space

---

## 1. What Is Flow?

Flow is Protech's production management system. It tracks:

- **Projects** and **tasks** (work packages) through completion
- **Employee time** (shift clock + task timers)
- **Quality assurance** reviews
- **Daily reports** (wrap-ups) at end of shift
- **Manager visibility** into capacity, risk, and alerts

---

## 2. Sign In

1. Go to https://flowproduction.space/login
2. Sign in with your company email and password (Supabase) or demo credentials (demo environments)
3. Flow routes you to your **default home** based on role:

| Role | Home Page |
|------|-----------|
| Employee | `/work` |
| Team Lead | `/operations` |
| Manager / Admin | `/operations` |
| Viewer | `/executive` |

---

## 3. Quick Start by Role

### Employee (Production Staff)

**Your daily loop:**

1. **Clock in** on `/work` when your shift starts (hourly employees).
2. **Open your top task** from "Today's Mission" or "My Queue."
3. **Start the task timer** on the task workspace (`/work/[task-id]`).
4. **Do the work** — upload files if required.
5. **Submit to QA** when complete.
6. If QA returns corrections, **fix and resubmit**.
7. **Submit your daily report** (wrap-up) before final clock-out.
8. **Clock out** (end of shift).

**Navigation (employee header):**
- **Workspace** — `/work`
- **Files & SOPs** — `/work/files`
- **My Scorecard** — `/scorecard`

**Need help?** Use the help/request-work action on your workspace — managers see it in Alert Center.

---

### Team Lead

**Your daily loop:**

1. Open **Operations** (`/operations`) — review team board.
2. Check **Alert Center** (`/alert-center`) — help flags, workload alerts, missing wrap-ups.
3. **Assign** unassigned or stuck work.
4. **Review QA queue** (`/qa-center`) if you perform QA.
5. **Review daily reports** (`/wrap-ups`) from your team.
6. Monitor **Time Clock** (`/time-clock`) for attendance and compliance.

**Key pages:** Operations, Alert Center, Wrap-ups, QA Center, People, Time Clock.

---

### Manager

Everything the Team Lead does, plus:

1. **Projects** (`/projects`) — create programs, monitor KPI strip, open project detail.
2. **Project Health** (`/project-health`) — delivery risk across portfolio.
3. **Planning** (`/planning`) — capacity and forecast snapshot.
4. **Reports** (`/reports`) — team productivity and QA metrics.
5. **Org Chart** (`/org-chart`) — seat assignments and live ops status.

**Create new work:** Click **New Work** → choose **New Project** (standard programs) or **New Task** (quick assignment).  
**Full walkthrough:** [Creating Projects & Tasks](/docs/creating-work) in Help & Docs.

---

### Administrator

Start with the [Administrator Guide](./ADMINISTRATOR_GUIDE.md). Day-one priorities:

1. **Users** (`/settings/users`) — create accounts, assign departments/teams/seats.
2. **Departments** (`/settings/departments`) — build org structure.
3. **Forecasting** (`/settings/forecasting`) — set company defaults.
4. **System Health** (`/system-health`) — resolve integrity issues.
5. **Workload Alerts** and **Work Visibility** — configure operational thresholds.

---

### Viewer (Read-Only)

1. Start at **Executive Dashboard** (`/executive`).
2. Drill into **Operations**, **Reports**, **Project Health** as needed.
3. You cannot edit data — use reports for oversight.

---

## 4. Core Concepts (5 Minutes)

### Hierarchy

```
Project → Workstream → Year/Phase → Task
```

- **Project** — The program (e.g., a client engagement).
- **Workstream** — Subdivision (labeled "Workstream" in UI; stored as Manufacturer).
- **Year/Phase** — Time or phase slice.
- **Task** — Individual assignable work package.

### Task Statuses (Simplified)

`Assigned` → `Working` → `Ready for QA` → `Done`

Side paths: `Stuck`, `Correction Needed`, `Waiting`

### Three Work Creation Options

| Option | When to Use |
|--------|-------------|
| **New Project** | Multi-task programs with forecasting — **most common** |
| **New Task** | Single quick assignment |
| **New Board** | Lightweight kanban queue (optional) |

---

## 5. Essential Buttons

| Location | Button | Action |
|----------|--------|--------|
| Operations / Projects | New Work | Opens creation wizard |
| Operations | Package card | Open detail, change status, assign |
| Employee workspace | Clock In/Out | Shift time tracking |
| Task workspace | Start Timer | Task time tracking |
| Task workspace | Submit to QA | Sends to QA queue |
| QA Center | Review | Pass or issue correction |
| Wrap-ups | Mark Reviewed | Manager acknowledges daily report |
| Alert Center | Acknowledge / Resolve | Close operational alerts |
| Projects KPI strip | KPI card | Filter portfolio by that metric |

---

## 6. Required Daily Actions

### Hourly Employees Must:

- [ ] Clock in at shift start
- [ ] Log time on tasks (timers)
- [ ] Submit daily wrap-up before final clock-out
- [ ] Document unassigned time if clock exceeds task time

### Team Leads / Managers Should:

- [ ] Review Alert Center
- [ ] Clear QA queue items
- [ ] Review team wrap-ups
- [ ] Assign or reassign blocked work

---

## 7. Where to Get Help

| Issue | Go To |
|-------|-------|
| Cannot access a page | Your admin — role may not include that route |
| QA returned my work | Task workspace — correction notes |
| Cannot clock out | Submit wrap-up first, or ask lead for override |
| Stuck on a task | Raise help flag from workspace |
| System misconfiguration | Admin → System Health |

**Full reference:** [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md)  
**Employee detail:** [EMPLOYEE_GUIDE.md](./EMPLOYEE_GUIDE.md)  
**Troubleshooting:** [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

---

## 8. First Week Checklist

### All Users
- [ ] Sign in successfully
- [ ] Confirm your role and home page
- [ ] Locate Files & SOPs for reference documents
- [ ] Submit one innovation hub idea (if enabled)

### Employees
- [ ] Complete one full task cycle (timer → QA → done)
- [ ] Submit one daily wrap-up
- [ ] View your scorecard

### Leads / Managers
- [ ] Create or assign one task
- [ ] Process one QA review
- [ ] Review one wrap-up
- [ ] Resolve one alert

### Admins
- [ ] Verify all users have department + team
- [ ] Run System Health and fix critical issues
- [ ] Confirm forecasting settings match production rates

---

*You now have enough to operate Flow on day one. Use role-specific guides for depth.*
