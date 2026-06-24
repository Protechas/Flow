# Creating Projects & Tasks

**Audience:** Team leads, managers, and admins who assign work  
**Time to read:** 10 minutes  
**In-app:** `/docs/creating-work`

This guide walks you through **creating a new project** or **creating a new task** in Flow — the same flows you use from the green **New Work** button on **Operations** and **Projects**.

---

## Before You Start

### Who can create work?

| Role | New Project | New Task | New Board |
|------|-------------|----------|-----------|
| Team Lead | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes |
| Senior Manager / Admin | Yes | Yes | Yes |
| Employee | No | No | No |

You need `projects:create` (and related assign permissions) for these actions.

### How work is organized

Flow stores production work in a hierarchy:

```
Project
 └── Workstream (manufacturer)
      └── Year / Phase
           └── Task (work package)
```

Employees work on **tasks**. Projects group many tasks under one program (forecasting, metrics, due dates).

**Rule of thumb:**

| You want to… | Use… |
|--------------|------|
| Stand up a full program with multiple workstreams and forecasting | **New Project** |
| Assign one piece of work quickly | **New Task** |
| A lightweight kanban queue for a team (not a full program) | **New Board** |

---

## Open the New Work Wizard

1. Go to **Operations** (`/operations`) or **Projects** (`/projects`).
2. Click the green **New Work** button (top right).
3. Choose a mode:

| Mode | Best for |
|------|----------|
| **New Project** | Multi-workstream programs, templates, metrics, forecasting |
| **New Task** | Fast single assignment with optional planning preview |
| **New Board** | Simple department/team queue (`project_type: board`) |

The wizard remembers your department and team defaults from your profile.

---

## Create a New Project (7 steps)

Use this when you are launching a program — not for a one-off assignment.

### Step 1 — Project basics

| Field | What to enter |
|-------|----------------|
| **Project name** | Required. Clear program name (e.g. `Q3 SI Production`). |
| **Description** | Optional. Outcomes or scope summary. |

Click **Continue**.

### Step 2 — Department & team

| Field | What to enter |
|-------|----------------|
| **Department** | Owns the program. Defaults from your team. |
| **Brand / workstream label** | Optional display name for the first workstream. |
| **Project owner** | Manager or lead responsible (shows **names**, not IDs). |
| **Priority** | Low / Medium / High / Urgent. |

Click **Continue**.

### Step 3 — Template

Pick an enterprise template **or** start from scratch.

- Templates seed **workstreams, years, starter tasks, metrics, and QA rules**.
- Preview the template before continuing.

Click **Continue**.

### Step 4 — Forecasting

| Field | What to enter |
|-------|----------------|
| **Estimated documents** | Total doc volume for planning (drives due-date forecast). |
| **Complexity** | Simple / Standard / Complex / Expert. |
| **Start date** | When work is expected to begin. |
| **Due date** | Committed or target completion. |

If you used a template with forecasting enabled, some values may be pre-filled.

Click **Continue**.

### Step 5 — Metrics

Review custom metrics that will track this project (from template defaults). You can add more later in the project detail panel.

Click **Continue**.

### Step 6 — QA & files

Review QA and file-upload expectations seeded from the template. No action required unless you need to note exceptions for your team.

Click **Continue**.

### Step 7 — Review

Confirm the summary panel, then click **Create work**.

**After creation:**

1. Open **Projects** — your project appears in the portfolio list.
2. Click the project row to open the **detail sheet**.
3. Add workstreams, years, or tasks as needed.
4. Open **Operations** to assign tasks to employees.

---

## Create a New Task (quick path)

Use this when you already have (or can create) a project and need to assign work **now**.

### Step 1 — Task details

| Field | What to enter |
|-------|----------------|
| **Task name** | Required (e.g. `TYT 2026 SF Build`). |
| **Project** | **Existing project** — pick from the list by **name**, or **New project** — type a new program name (Flow creates the hierarchy for you). |
| **Assign to** | Employee who will do the work (or leave unassigned). |
| **Est. documents** | Document count for forecast (e.g. `180`). |
| **Complexity** | Drives time estimate. |
| **Priority** | Task priority. |

**Advanced settings** (optional):

- **Manufacturer** — workstream name (defaults to `General` if blank).
- **Year** — model year or phase (defaults to current year).

Click **Continue**.

### Step 2 — Task impact review

Review the planning preview:

- Estimated hours and days
- Suggested due date
- Capacity / risk impact on the department

This is a **preview only** — adjust document count or complexity if the forecast looks wrong.

Click **Create work**.

**After creation:**

- The task appears on **Operations** under its project → workstream → year.
- The assignee sees it on **My Queue** (`/work`) when status is **Assigned** or **Working On It**.

---

## Other Ways to Add Tasks

You do not have to use **New Work** every time.

### From an existing project

1. Go to **Projects** (`/projects`).
2. Click the project to open the **detail sheet**.
3. Expand **Workstream → Year / Phase**.
4. Click **Add task**.
5. Fill assignee, document estimate, complexity.
6. Confirm the **Task Impact Review** step.
7. Click **Confirm & create task**.

### From Operations

1. Go to **Operations** (`/operations`).
2. Expand the tree to the correct **year / phase** row.
3. Use **Add task** on that row (same dialog as above).

---

## Create a New Board (optional)

Boards are lightweight project containers for team queues — not full programs.

1. **New Work → New Board**
2. Enter **board name**, **department**, and optional **purpose** description.
3. Create — the board appears in Projects with type **board**.

Use boards when you need a shared list, not forecasting and portfolio metrics.

---

## After You Create Work

| Next step | Where |
|-----------|--------|
| Assign or reassign | Operations detail panel → **Assigned To** |
| Set status to Assigned | Operations → status column |
| Employee starts work | Employee opens task on `/work`, starts timer |
| Track progress | Operations, Project Health, Planning |
| QA when ready | Employee submits → **QA Center** |

### Task status flow (reference)

```
Not started → Assigned → Working on it → Ready for QA → In QA → Done
```

---

## Common Questions

### I created a project but don’t see it

- Refresh **Projects** — filter may be set to a department or KPI (e.g. “At risk only”).
- Confirm you are in the correct **department scope**.
- Admins: check **System Health** if persistence issues are suspected.

### Dropdowns show weird codes instead of names

- Hard refresh the page (`Ctrl+Shift+R`). Names should display for department, project, and assignee fields.
- If a name is still missing, ask an admin to verify the user or project exists and is active.

### New Task created a project I didn’t expect

- **New project** mode on the task wizard creates a minimal program shell plus workstream/year nodes so the task has a valid place in the tree. Use **Existing project** if the program already exists.

### Employee doesn’t see the task

1. Confirm **Assign to** is set to that employee.
2. Status should be **Assigned** or **Working on it** (not *Not started* with no assignee).
3. Employee must be **active** and **production-ready** (department + team assigned).

### When should I use a template?

Use a template when the program matches a standard pattern (SI production, ADAS, corrections, etc.). Templates save time and ensure metrics and QA rules are consistent.

---

## Quick Reference

| Goal | Path |
|------|------|
| Full program | **New Work → New Project** (7 steps) |
| One assignment | **New Work → New Task** |
| Add under existing year | **Projects** or **Operations** → **Add task** |
| Team queue only | **New Work → New Board** |
| Simulate before creating | **Planning** → What-If Simulator (no save) |

---

## Related Docs

- [Quick Start Guide](./QUICK_START.md) — day-one orientation
- [Manager Guide](./MANAGER_GUIDE.md) — daily manager routine
- [Team Lead Guide](./TEAM_LEAD_GUIDE.md) — operations supervision
- [Operations Manual](./OPERATIONS_MANUAL.md) — Sections 6 & 7 (full reference)
