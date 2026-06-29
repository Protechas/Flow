# Creating Projects & Tasks

**Audience:** Team leads, managers, and admins who assign work  
**Time to read:** 10 minutes  
**In-app:** `/docs/creating-work`

This guide walks you through creating programs, boards, and tasks in Flow — the same flows available from **Operations**, **Projects**, and **team dashboards**.

---

## Before You Start

### Who can create work?

| Role | New Program | New Task | New Board |
|------|-------------|----------|-----------|
| Team Lead | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes |
| Senior Manager / Admin | Yes | Yes | Yes |
| Employee | No | No | No |

You need `projects:create` (and related assign permissions) for these actions.

### How work is organized

Flow stores production work in a hierarchy. **Labels change by team** — your operating model may show Manufacturer/Year, Workstream/Milestone, Dataset/Batch, or other terms:

```
Project
 └── Work package (e.g. Manufacturer, Workstream, Dataset)
      └── Phase (e.g. Year, Milestone, Validation Batch)
           └── Task (work package)
```

Employees work on **tasks**. Projects group many tasks under one program (forecasting, metrics, due dates).

**Rule of thumb:**

| You want to… | Use… |
|--------------|------|
| Stand up a full program with structure or a make/year matrix | **New Program** |
| Assign one piece of work quickly | **New Work → Task** |
| A lightweight kanban queue for a team | **New Work → Board** |

---

## Where to Open Creation Flows

| Location | Buttons |
|----------|---------|
| **Operations** (`/operations`) | New Program, New Work (board + task) |
| **Projects** (`/projects`) | Same header actions |
| **Team dashboard** (`/teams/{slug}`) | New Program, New Work — scoped to team |

Department and team defaults come from your profile. Team dashboards also apply the team's **operating model** (labels, project type, QA defaults).

---

## Create a New Program

Click **New Program** (green button on Operations, Projects, or a team dashboard).

### Step 1 — Choose blueprint

| Blueprint kind | Best for |
|----------------|----------|
| **Structure** | Custom program with work packages, phases, and starter tasks |
| **Matrix** | Make × year bulk programs (SI-style production) |

Pick a blueprint or enterprise template. Preview structure before continuing.

### Step 2 — Program details

| Field | What to enter |
|-------|----------------|
| **Name** | Required program name |
| **Department / Team** | Defaults from your profile or team dashboard |
| **Project type** | ADAS, SI Corrections, Research, Custom, etc. — may default from operating model |
| **Structure mode** | By manufacturer, by workstream, simple task list, etc. |
| **Owner** | Manager or lead responsible |

### Step 3 — Structure & tracking

- Add work packages (labeled per your team's model)
- Add phases and optional starter tasks
- Set QA, files, and metric tracking as needed

### Step 4 — Review & create

Confirm the structure preview, then create. The program appears in **Projects** and on team dashboards when in scope.

---

## Create a New Task (quick path)

**New Work → Task** (or task-only button if your role doesn't use the full hub).

### Task details

| Field | What to enter |
|-------|----------------|
| **Task name** | Required |
| **Project** | Pick existing program or create minimal shell |
| **Assign to** | Employee (optional) |
| **Work estimate** | Documents, records, or units — label depends on team model |
| **Complexity / Priority** | Drives forecast |

**Placement** (when shown): work package and phase pickers use your team's labels. Advanced Projects teams may not see Year; SI teams see Manufacturer/Year.

### After creation

- Task appears on **Operations** under its project tree
- Assignee sees it on **My Queue** (`/work`) when status is Assigned or Working On It

---

## Create a New Board

Boards are lightweight project containers for team queues — not full programs.

1. **New Work → Board** (or Board-only button)
2. Enter name, department, template (custom, QA queue, etc.)
3. Optional first task on create

Boards appear in Projects with type **board**.

---

## Other Ways to Add Tasks

### From an existing project

1. **Projects** → open project detail sheet  
2. Expand work package → phase  
3. **Add task** → confirm impact review → create  

### From Operations

1. Expand tree to the correct phase row  
2. **Add task** on that row  

### From a team dashboard

Use **Add task** on a program card in the portfolio section.

---

## Team Operating Models (What Changes Per Team)

| Team style | Typical labels | Hidden fields |
|------------|----------------|---------------|
| Service Information | Manufacturer / Year | — |
| Advanced Projects | Workstream / Milestone | Year picker often hidden |
| ID³ Validation | Dataset / Batch | Document language minimized |
| Training | Module / Phase | Standard doc tracking |

Configured by admins — see [Team Operating Models](/docs/team-operating-models). You don't configure this; you just see the right fields.

---

## After You Create Work

| Next step | Where |
|-----------|--------|
| Assign or reassign | Operations detail panel → Assigned To |
| Set status to Assigned | Operations status column |
| Employee starts work | `/work` → start timer |
| Track progress | Operations, Project Health, Planning, team dashboard |
| QA when ready | Employee submits → QA Center |

### Task status flow

```
Not started → Assigned → Working on it → Ready for QA → In QA → Done
```

---

## Common Questions

### I created a program but don't see it on the team dashboard

- Dashboard **scope** may filter by team, project type, or explicit IDs — ask admin to check pack config.
- Refresh the page.

### Dropdowns show codes instead of names

- Hard refresh (`Ctrl+Shift+R`). Names should display for department, project, and assignee.

### Employee doesn't see the task

1. Confirm **Assign to** is set  
2. Status should be Assigned or Working on it  
3. Employee must be active with department + team assigned  

### When should I use a blueprint vs custom?

Use a blueprint or enterprise template for standard patterns (SI matrix, ADAS structure). Use custom for one-off programs.

---

## Quick Reference

| Goal | Path |
|------|------|
| Full program | **New Program** |
| One assignment | **New Work → Task** |
| Add under existing phase | Projects or Operations → **Add task** |
| Team-scoped creation | Team dashboard header |
| Team queue only | **New Work → Board** |
| Simulate before creating | **Planning** → What-If Simulator |

---

## Related Docs

- [Team Dashboards](./TEAM_DASHBOARDS.md)
- [Team Operating Models](./TEAM_OPERATING_MODELS.md)
- [Quick Start Guide](./QUICK_START.md)
- [Manager Guide](./MANAGER_GUIDE.md)
- [Operations Manual](./OPERATIONS_MANUAL.md)
