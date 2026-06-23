# Flow Employee Guide

**Role:** `employee`  
**Home page:** `/work`  
**Layout:** Employee header (no management sidebar)

---

## Your Workspace

When you sign in, you land on **Workspace** (`/work`). This is your command center for the day.

### Main Sections

| Section | Purpose |
|---------|---------|
| **Today's Mission** | Your highest-priority focus for today |
| **My Queue** | Assigned tasks waiting for you |
| **Up Next** | Upcoming tasks after current work |
| **Quick Actions** | Clock, help request, work request, wrap-up |
| **Attention Panel** | QA returns, blockers, compliance reminders |
| **Today's Score** | Daily productivity snapshot |

---

## Navigation

| Link | Route | Purpose |
|------|-------|---------|
| Workspace | `/work` | Home dashboard |
| Files & SOPs | `/work/files` | Company reference documents |
| My Scorecard | `/scorecard` | Personal performance metrics |
| Notifications | `/notifications` | System notifications (header bell) |

You **cannot** access management pages (`/operations`, `/projects`, `/settings`). Attempts redirect to `/work`.

---

## Daily Workflow

### Step 1: Clock In (Hourly Employees)

1. On `/work`, click **Clock In** when your shift starts.
2. Your clock status shows as active on the workspace.

**Salary employees:** Shift clock may not be required (`requiresShiftClock` = false). Task timers still track production time.

### Step 2: Select a Task

1. Open a task from **Today's Mission** or **My Queue**.
2. You arrive at the task workspace: `/work/[task-id]`.

You can only open tasks assigned to you (or in your scope). Unauthorized tasks redirect.

### Step 3: Work the Task

On the task workspace:

| Action | When |
|--------|------|
| **Start Timer** | Begin production time tracking |
| **Pause / Resume** | Breaks or interruptions |
| **Stop Timer** | Finished working session |
| **Upload Files** | When deliverables require file attachment |
| **Change Status** | Move to Working, Stuck, Waiting as appropriate |
| **Add Comments** | Notes for QA or manager |

**If stuck:** Set status to **Stuck** and/or raise a **Help Flag** — your lead sees it in Alert Center.

### Step 4: Submit to QA

When work is complete:

1. Ensure required files are uploaded.
2. Click **Submit to QA**.
3. Task status becomes **Ready for QA**.
4. QA reviewer processes it in QA Center.

You cannot approve your own QA — only submit.

### Step 5: Handle QA Returns

If QA issues a correction:

1. Task returns to **Correction Needed** status.
2. View correction notes on your workspace (QA Returns panel).
3. Fix the issues, re-upload if needed.
4. Resubmit to QA.

Correction types: minor, major, rejected (severity varies).

### Step 6: Daily Report (Wrap-Up)

Before **final clock-out** (hourly employees):

1. Open the **Daily Report** / wrap-up form on `/work`.
2. Complete required fields:

| Field | Purpose |
|-------|---------|
| Completed summary | What you accomplished today |
| Blockers | Issues that slowed you down |
| Needs support | Flag if you need manager help |
| Activity documentation | Required if clock time exceeds task time |

3. Submit the wrap-up.

**"Not yet" button:** Defers the report — you cannot final clock-out until submitted (unless manager overrides).

### Step 7: Clock Out

1. **Lunch:** Clock out (lunch) — pauses shift, keeps you on clock for the day.
2. **End of shift:** Clock out (end) — requires wrap-up for hourly employees.
3. Active task timer may be force-stopped on final clock-out.

---

## Time Tracking Rules

| Type | What It Tracks |
|------|----------------|
| **Shift clock** | Total time on shift (Time Clock entries) |
| **Task timer** | Time on specific task (Task Time entries) |

**Compliance:** Flow compares clock time to task time. If you have **unassigned minutes** (clocked but not on tasks), you must document them in your wrap-up.

Managers see compliance % on wrap-ups and Work Visibility reports.

---

## Files & SOPs

**Route:** `/work/files`

- View and download company SOPs, policies, and reference documents.
- You cannot upload company documents — only task files on your assigned tasks.
- Document viewer: `/work/files/view/company/[id]` or task files via task workspace.

---

## Help & Escalation

### Raise a Help Flag

From workspace quick actions:

1. Select reason (stuck, training, workload, etc.).
2. Optionally link to current task.
3. Submit — appears in manager Alert Center.

### Request Work

If you have no assigned tasks and are eligible, use **Request Work** — creates a workload signal for your lead.

### Need Support in Wrap-Up

Check **Needs support** and add a note — may auto-create a help flag for managers.

---

## My Scorecard

**Route:** `/scorecard`

Shows your personal performance metrics:

- Flow Score
- QA pass rate
- Active / overdue / stuck items
- Productivity trends

If no scorecard data exists, you may redirect to `/work`.

---

## Your Profile

**Route:** `/people/[your-id]` (accessible for own profile only)

View-only profile with scorecard summary. You **cannot** edit your own profile in Flow — contact an admin for changes.

---

## Innovation Hub

Employees can submit ideas, bugs, and feature requests (`innovation_hub:submit` permission). Submissions are triaged by managers/admins in Innovation Hub.

---

## Status Reference

| Status | What It Means | Your Action |
|--------|---------------|-------------|
| Assigned | Task is yours, not started | Start timer, begin work |
| Working On It | Active production | Continue; upload files |
| Stuck | Blocked | Fix blocker or raise help flag |
| Waiting | External dependency | Wait; update when unblocked |
| Ready for QA | Awaiting review | Wait for QA decision |
| Correction Needed | QA returned | Fix and resubmit |
| Done | Complete | Move to next task |

---

## Common Questions

**Why can't I clock out?**  
Submit your daily wrap-up first. Hourly employees are gated by wrap-up compliance.

**Why don't I see a task?**  
It may not be assigned to you yet. Use Request Work or contact your lead.

**Why was my QA rejected?**  
Read correction notes on the task workspace. Fix issues and resubmit.

**Where are company procedures?**  
Files & SOPs (`/work/files`).

**Can I see team operations?**  
No — employee role is scoped to own work only.

---

## Employee Checklist

### Every Shift
- [ ] Clock in (if hourly)
- [ ] Run task timers on all production work
- [ ] Submit completed tasks to QA
- [ ] Address any QA returns same day if possible
- [ ] Submit daily wrap-up
- [ ] Clock out

### Weekly
- [ ] Review scorecard trends
- [ ] Read any new SOPs in Files
- [ ] Confirm queue has upcoming work assigned

---

*Troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) · Full manual: [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md)*
