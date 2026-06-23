# Flow System Health Audit

**Purpose:** Section 19 deliverable — identify unused pages, dead ends, incomplete workflows, and user confusion points from codebase review.  
**Audience:** Administrators, product owners, development team  
**Method:** Static analysis of routes, permissions, settings, navigation, and action wiring in `flow/src`

---

## Executive Summary

Flow is a **functionally complete production management platform** with mature modules for operations, projects, QA, workforce tracking, and executive reporting. The audit found **no TODO/FIXME markers** in source code, but identified **configuration gaps**, **permission inconsistencies**, and **discoverability issues** that may confuse users — particularly around settings persistence, hidden admin pages, and route allowlist mismatches.

**Severity counts:**

| Severity | Count | Examples |
|----------|-------|----------|
| High | 3 | People route blocked for senior_manager; work visibility cookie-only; help flag settings missing |
| Medium | 6 | Hidden settings pages, QA allowlist gap, no project deep links |
| Low | 5 | Legacy redirects, page title fallbacks, audit log gaps |

---

## Unused or Hidden Pages

| Route | Status | Notes |
|-------|--------|-------|
| `/dashboard` | Redirect only | Alias to `/executive` — kept for bookmarks |
| `/work-tracker` | Redirect only | Alias to `/operations` |
| `/team`, `/team/[id]` | Redirect only | Alias to `/people` |
| `/performance` | **Functional but hidden** | Linked from Reports/People; not in sidebar |
| `/settings/forecasting` | Functional | Not in sidebar — Settings hub link only |
| `/settings/workload-alerts` | Functional | Not in sidebar |
| `/settings/work-visibility` | Functional | Not in sidebar |
| `/reports/work-visibility` | Functional | Linked from Reports page only |
| `/projects/[id]` | **Does not exist** | Detail is in-page sheet — no shareable project URL |

**Recommendation:** Add settings sub-navigation or sidebar entries for forecasting, workload alerts, and work visibility. Add `/performance` to Reporting nav or rename cross-links.

---

## Dead Buttons / Non-Functional UI

No fully dead buttons found in critical paths. Specific notes:

| Item | Finding |
|------|---------|
| User wizard / bulk invite | Hidden (not dead) when service role key missing — correct gating |
| Settings profile Edit | Intentionally absent — read-only by design |
| Project summary CSV export | Removed from client panel — export lives on Reports/Project Health (intentional split) |
| "Not yet" on wrap-up dialog | Defers report — functional, not placeholder |
| Duplicate New Work button | **Fixed** in recent release — removed from project workspace |

---

## Incomplete Workflows

### 1. Help Flag Settings (High)

- **DB table exists:** `help_flag_settings` (migration `015_help_flags.sql`)
- **Hydration works:** `hydrateHelpFlagSettingsFromSupabase()`
- **Persistence missing:** `persistHelpFlagSettingsToSupabase()` never called
- **No admin UI:** Escalation thresholds hardcoded (30/60 min critical idle)

**User impact:** Admins cannot tune help flag sensitivity.  
**Recommendation:** Add `/settings/help-flags` or section in Alert Center settings.

### 2. Work Visibility Settings Persistence (High)

- **UI exists:** `/settings/work-visibility`
- **Persistence:** Cookie + in-memory only — no Supabase table
- **Unlike:** Forecast and workload alerts which persist to DB

**User impact:** Multi-admin deployments have inconsistent visibility rules per browser.  
**Recommendation:** Add Supabase migration mirroring `workload_alert_settings` pattern.

### 3. Platform Settings Audit Trail (Medium)

- User/org changes logged
- Forecast, workload, visibility changes **not** audit-logged

**Recommendation:** Call `writeAuditLog` in settings server actions.

### 4. Employee Self-Service Profile (Medium)

- Employees cannot edit contact info
- Admins cannot self-edit on Settings page

**Recommendation:** Add limited self-service fields or clarify in onboarding.

### 5. Board vs Project UX (Low — Product)

- Three creation modes (Board, Project, Task) may confuse users who primarily use Projects
- Board linking is description-based, not structural

**Recommendation:** Product decision — simplify wizard default to Project-only or improve board labeling.

---

## Permission & Route Inconsistencies

| Issue | Detail | Impact |
|-------|--------|--------|
| **Senior manager + `/people`** | Nav shows People; `ROUTE_ROLE_ALLOWLIST` excludes `senior_manager` | Unauthorized redirect despite `people:view_all` permission |
| **Super admin + `/qa-center`** | Has `qa:review` but not in QA allowlist | QA page blocked for super_admin |
| **Nav vs allowlist drift** | Some NAV_CONFIG roles differ from ROUTE_ROLE_ALLOWLIST | Occasional nav item → unauthorized |
| **`/performance` allowlist** | Not in ROUTE_ROLE_ALLOWLIST | Access via permission check only |

**Recommendation:** Align `NAV_CONFIG`, `ROUTE_ROLE_ALLOWLIST`, and `ROLE_PERMISSIONS` in single audit pass. Add senior_manager to `/people` allowlist.

---

## Broken Links

**No 404 href targets found** among settings, system health, alert center, or planning deep links.

Verified working anchors:
- `/settings/users#user-{id}`
- `/alert-center#help-flags`, `#workload-alerts`
- `/planning#calendar`
- `/reports/work-visibility#gaps`

**Misleading link (not broken):**
- System Health "incomplete forecast inputs" → `/settings/forecasting` (company defaults) instead of task-level fix location (`/operations` or `/planning`)

---

## Potential User Confusion

| Topic | Confusion | Clarification Needed |
|-------|-----------|---------------------|
| Workstream vs Manufacturer | Internal name differs from UI label | Documented in hierarchy-labels.ts — UI says "Workstream" |
| Board vs Project vs Task | Three creation options | Quick Start explains; Projects are default |
| No project URL | Cannot bookmark project detail | Share project name + filter on `/projects` |
| Wrap-up vs task complete | Different concepts | Employee guide covers; both required |
| Shift clock vs task timer | Two time systems | Employee guide covers |
| Demo vs production | Role switcher only in demo | Settings hub shows data source badge |
| Custom metrics vs KPIs | Two metric layers | Operations manual Section 6 + 10 |
| Viewer appears read-only but has broad access | Viewer sees operations board | By design for oversight |

---

## Data Layer Gaps

| Gap | Detail |
|-----|--------|
| Work packages | Primary path through flow-store; not all Supabase-synced |
| Year work items | `getYearWorkItems` not fully Supabase-backed |
| Demo audit log | Ephemeral on server restart |
| Metrics dual storage | Memory + optional DB hydration |
| Task time entries | production-tracking in-memory |

**Impact:** Demo/production parity differences; backup strategy should focus on Supabase tables.

---

## System Health Check Categories (18 Types)

The `/system-health` page validates:

1. Employees without team assignment
2. Active tasks without assignee
3. Invalid task assignees
4. Users missing manager
5. Invalid manager references
6. Invalid team references
7. Invalid department references
8. Tasks missing due dates
9. Weak forecast inputs
10. Orphan workload alerts
11. Orphan help flags
12. Orphan alert task links
13. Orphan wrap-up records
14. Empty active projects
15. Orphan org positions
16. Duplicate org seats
17. Circular org hierarchy
18. Vacant leadership positions / users without seats

**Recommendation:** Run weekly; export issues for standup until count reaches zero.

---

## Documentation Gaps (Pre-This-Audit)

| Item | Status |
|------|--------|
| README.md | Only covers Users setup for Supabase |
| In-app help | None — relies on training |
| Role guides | **Now in `/docs`** |
| API documentation | Server actions undocumented externally — covered in FEATURE_REFERENCE |

---

## Recommendations Priority Matrix

| Priority | Action | Effort |
|----------|--------|--------|
| P0 | Fix senior_manager `/people` allowlist | Low |
| P0 | Fix super_admin `/qa-center` allowlist | Low |
| P1 | Add Supabase persistence for work visibility settings | Medium |
| P1 | Add Help Flag settings admin UI | Medium |
| P2 | Settings sub-nav or sidebar entries | Low |
| P2 | Audit-log platform setting changes | Low |
| P2 | Fix System Health forecast review link target | Low |
| P2 | Add page titles for system-health, work-visibility | Low |
| P3 | Project deep-link route `/projects/[id]` | Medium |
| P3 | Employee self-service profile fields | Medium |
| P3 | Consolidate NAV_CONFIG and allowlist source of truth | Medium |
| P4 | Simplify New Work wizard defaults (project-first) | Product |

---

## Pages Verified Functional

All `(app)` and `(employee)` page.tsx files exist and render with appropriate guards:

- Executive, Operations, Projects, QA, People, Org Chart, Planning, Reports, Analytics
- Project Health, Production, Time Clock, Wrap-ups, Alert Center, Files
- Settings (all sub-pages), System Health, Innovation Hub, Templates
- Employee work, task workspace, files, scorecard
- Auth flows (login, signup, reset)

**Build status:** Production deploy successful as of latest project upgrade pass.

---

*Feature inventory: [FEATURE_REFERENCE.md](./FEATURE_REFERENCE.md) · Troubleshooting: [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)*
