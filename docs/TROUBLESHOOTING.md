# Flow Troubleshooting Guide

**Audience:** All roles  
**Escalation path:** Employee → Team Lead → Manager → Administrator

---

## Access & Authentication

### Cannot sign in

| Cause | Resolution |
|-------|------------|
| Wrong email/password | Use forgot password at `/auth/forgot-password` |
| Account disabled | Admin re-enables on `/settings/users` |
| Supabase not configured (demo) | Use demo credentials or role switcher on Settings |
| Invite not completed | Check email; complete via `/auth/reset-password` link |

### Redirected to `/unauthorized`

| Cause | Resolution |
|-------|------------|
| Role lacks route permission | Verify role assignment with admin |
| Role not in route allowlist | Known gaps: senior_manager on `/people`, super_admin on `/qa-center` — admin must adjust allowlist or use alternate route |
| Employee accessing management URL | Expected — use `/work` |

### Wrong home page after login

Check role default routes:
- Employee → `/work`
- Team Lead → `/operations`
- Viewer → `/executive`

---

## Employee Issues

### Cannot clock out

| Cause | Resolution |
|-------|------------|
| Missing daily wrap-up | Submit wrap-up on `/work` first |
| Wrap-up required setting enabled | Complete all wrap-up fields including activity documentation if unassigned minutes > 0 |
| Manager override needed | Lead/manager uses override on wrap-ups page |

### Task timer won't start

| Cause | Resolution |
|-------|------------|
| Task not assigned to you | Contact lead for assignment |
| Already active timer on another task | Stop or pause other timer first |
| Task in wrong status | Status may need to be Working On It |

### Cannot submit to QA

| Cause | Resolution |
|-------|------------|
| Missing required files | Upload files on task workspace |
| Wrong status | Task must be in workable state (not already done) |
| Permission missing | Employee role includes `work:submit_qa` — contact admin if stripped |

### QA return not visible

Check **Attention Panel** and task workspace QA Returns section on `/work/[id]`. Refresh page if recently updated.

### Don't see assigned tasks

| Cause | Resolution |
|-------|------------|
| Not yet assigned | Use Request Work or contact lead |
| Wrong department scope | Admin verifies department/team on user profile |
| Task completed | Check Up Next list |

---

## Manager / Lead Issues

### Team member not visible

| Cause | Resolution |
|-------|------------|
| Outside reporting branch | Verify supervisor hierarchy and org seat |
| Missing department/team | Admin fixes on Users page |
| User inactive | Re-enable account |

### Cannot assign task

| Cause | Resolution |
|-------|------------|
| Missing `work:assign` | Role issue — contact admin |
| Assignee outside scope | Choose team member in your branch |
| Invalid user ID | System Health may show invalid assignees — fix |

### QA queue empty but tasks waiting

| Cause | Resolution |
|-------|------------|
| Status not ready_for_qa | Submit from Operations or employee workspace |
| Tasks outside team scope | Viewer with broader access may see them |
| Filter active | Clear QA center filters |

### Alerts not appearing

| Cause | Resolution |
|-------|------------|
| Alerts disabled | Admin checks `/settings/workload-alerts` and `/settings/work-visibility` |
| Department scope excludes team | Admin expands scope on workload settings |
| Already dismissed/snoozed | Check snooze expiry |
| Help flag settings | No UI — defaults apply |

### Wrap-up not in list

| Cause | Resolution |
|-------|------------|
| Employee hasn't submitted | Check Time Clock compliance column |
| Outside team scope | Hierarchy scoping |
| Wrong date filter | Adjust date on wrap-ups page |

---

## Project & Forecast Issues

### No due date on project/task

| Cause | Resolution |
|-------|------------|
| Missing document estimate | Add `estimated_document_count` on task or project |
| Forecast settings empty | Admin configures `/settings/forecasting` |
| No working days selected | Admin must select at least one working day |

### Forecast shows "at risk" incorrectly

| Cause | Resolution |
|-------|------------|
| Complexity level too high | Review complexity assignment |
| Productive hours too low | Adjust forecast settings |
| Actual progress slower than plan | Reassign resources or extend due date manually |

### Project not in portfolio

| Cause | Resolution |
|-------|------------|
| Archived | Toggle archived filter |
| Board type filtered out | Boards may filter differently — check all projects |
| Department filter active | Clear department filter |
| Outside scope | Senior manager sees org-wide; manager sees team |

### Custom metrics not showing

| Cause | Resolution |
|-------|------------|
| Not defined on project | Add via project detail Metrics panel |
| Template didn't seed | Manually add definitions from template defaults |
| Hydration lag | Refresh; verify Supabase migration 027 applied |

---

## Admin Issues

### User wizard / bulk invite hidden

**Cause:** `SUPABASE_SERVICE_ROLE_KEY` not configured.  
**Resolution:** Set env var in Vercel/hosting; redeploy.

### Settings not saving

| Cause | Resolution |
|-------|------------|
| Demo cookie mode | Expected in demo — configure Supabase for shared persistence |
| Work visibility only | Cookie-only by design — document centrally until DB migration added |
| No working days (forecast) | Select at least one day before save |

### System Health shows many issues

Prioritize by severity:
1. **Critical** — Invalid assignees, circular hierarchy, orphan users
2. **Warning** — Missing estimates, vacant leadership, wrap-up orphans
3. **Info** — Empty projects, weak inputs

Use Review links; for forecast inputs prefer `/operations` over `/settings/forecasting`.

### Migrations not applied

```bash
cd flow
npm run migrate:pending
```

Verify `026_user_profile_fields.sql` and `027_project_custom_metrics.sql`.

### Audit log empty in demo

Expected — demo audit is in-memory only.

---

## Data & Sync Issues

### Changes not reflecting

| Cause | Resolution |
|-------|------------|
| Browser cache | Hard refresh |
| Revalidation delay | Wait seconds; navigate away and back |
| Demo mode restart | Server restart clears in-memory demo data |
| Dual storage desync | Admin checks Supabase vs flow-store paths |

### Team dashboard shows no programs

| Cause | Resolution |
|-------|------------|
| Scope too narrow | Admin checks project types, team ID, and explicit project IDs in pack |
| Projects not on team | Assign `team_id` on projects or add types to scope |
| No access | Verify your role is in dashboard access list |

### Wrong labels (Manufacturer vs Workstream)

| Cause | Resolution |
|-------|------------|
| Operating model not assigned | Admin assigns model to team at `/settings/operating-models` |
| Legacy project type | Model inferred from `project_type` — update team assignment if needed |

### Demo mode not using sample data

| Cause | Resolution |
|-------|------------|
| `NEXT_PUBLIC_FLOW_DEMO_MODE` not `true` | Set in `.env.local` and restart dev server |
| Supabase mode active | Demo flag must be `true` even if Supabase keys are present |

### Files won't upload

| Cause | Resolution |
|-------|------------|
| Storage bucket not configured | Admin verifies Supabase storage |
| Missing permission | Company docs need `company_documents:manage` |
| File too large | Check Supabase storage limits |

---

## Known Platform Issues (Workarounds)

| Issue | Workaround |
|-------|------------|
| Senior manager blocked on `/people` | Use `/org-chart` or `/people/[id]` direct links |
| Super admin blocked on `/qa-center` | Use admin role switch or fix allowlist in code |
| No `/projects/[id]` URL | Use Projects page + click project row |
| Team dashboard missing from sidebar | Admin configures pack nav + access at `/settings/team-dashboards` |
| Work visibility settings not shared | Document settings in runbook; admin sets on each browser until fixed |
| Help flag thresholds not configurable | Defaults: 30/60 min critical idle |
| Performance page hidden | Navigate from Reports or People links |
| System Health forecast link misleading | Manually go to Operations/Planning for task fixes |

Full audit: [SYSTEM_HEALTH_AUDIT.md](./SYSTEM_HEALTH_AUDIT.md)

---

## Admin Actions Reference

| Problem | Admin Action |
|---------|--------------|
| User access wrong | `/settings/users` → edit role, dept, team |
| Org structure broken | `/settings/departments` + `/org-chart` + System Health |
| Forecasts broken globally | `/settings/forecasting` → save to recalculate |
| Alerts too noisy/quiet | `/settings/workload-alerts` |
| Clock-out gate wrong | `/settings/work-visibility` → wrap-up required toggle |
| Data integrity | `/system-health` → fix each issue |
| Password issues | Resend invite / reset email from Users table |

---

## When to Contact Development

- Persistent 500 errors on save actions
- Supabase auth callback failures
- Migration failures
- Widespread data loss after deploy
- Security concern (unauthorized data visible across branches)

Include: user role, route URL, action attempted, error message, timestamp.

---

*Operations manual: [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) · Admin guide: [ADMINISTRATOR_GUIDE.md](./ADMINISTRATOR_GUIDE.md)*
