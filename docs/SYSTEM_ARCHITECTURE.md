# Flow System Architecture Summary

**Application:** Next.js App Router (React)  
**Production:** https://flowproduction.space (Vercel)  
**Database:** Supabase (PostgreSQL) when configured; demo in-memory fallback  
**Auth:** Supabase Auth (production) or demo session (development)

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Browser)                       │
│  (app) layout — Management sidebar + header                  │
│  (employee) layout — Employee header                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              Next.js App Router (src/app)                    │
│  Pages (RSC) + Client Components + Server Actions            │
└──────────────────────────┬──────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ flow-store   │  │ production-  │  │ Supabase     │
│ (in-memory + │  │ tracking     │  │ (PostgreSQL, │
│  localStorage│  │ (clock,timers│  │  Storage,    │
│  + optional  │  │  uploads)    │  │  Auth)       │
│  DB sync)    │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘
```

---

## Application Layers

| Layer | Location | Responsibility |
|-------|----------|----------------|
| Routes / Pages | `src/app/(app)/`, `src/app/(employee)/` | URL entry points, data loading |
| Server Actions | `src/app/actions/` | Mutations, revalidation, auth checks |
| Data modules | `src/lib/data/` | Read aggregations, store access |
| Business logic | `src/lib/*/` | Forecast, alerts, QA, wrap-up, metrics engines |
| Auth | `src/lib/auth/` | Permissions, guards, middleware, session |
| Components | `src/components/` | UI by domain |
| Types | `src/types/flow.ts` | Domain type definitions |
| Migrations | `supabase/migrations/` | Schema evolution |

---

## Route Architecture

### Layout Groups

| Group | Path prefix | Users |
|-------|-------------|-------|
| `(app)` | Management routes | admin, senior_manager, manager, teamlead, viewer |
| `(employee)` | `/work`, `/scorecard` | employee |
| Auth | `/login`, `/auth/*` | public |

**Employee redirect:** `(app)/layout.tsx` redirects `employee` role to `/work`.

### Access Control Stack

1. **Middleware** (`middleware.ts`) — session validation, `roleCanAccessPath()`
2. **Page guard** — `requirePageAccess(path)` or `requirePagePermission(perm)`
3. **Object guard** — `requireWorkPackageAccess`, `requireHierarchyUserAccess`
4. **Action guard** — `requirePermission()` in server actions

Source: `src/lib/auth/permissions.ts`, `src/lib/auth/guard.ts`

---

## Data Model

### Work Hierarchy

```
Project
  └── Manufacturer (UI: Workstream)
        └── YearWorkItem (UI: Year/Phase)
              └── WorkPackage (UI: Task)
```

### Supporting Entities

| Entity | Store | Supabase Table |
|--------|-------|----------------|
| User | flow-store + users.ts | `users` |
| Department / Team | flow-store | `departments`, `teams` |
| OrgPosition | org-positions | `org_positions` |
| QaReview | flow-store | `qa_reviews` |
| Correction | flow-store | corrections (via store) |
| DailyWrapUp | flow-store | wrap-ups |
| CompanyDocument | company-documents | storage + metadata |
| TimeClockEntry | production-tracking | optional persistence |
| TaskTimeEntry | production-tracking | in-memory |
| ProjectMetricDefinition | project-metrics | `project_metric_definitions` |
| ProjectMetricValue | project-metrics | `project_metric_values` |
| ForecastSettings | flow-store | `forecast_settings` |
| WorkloadAlertSettings | hydrate | `workload_alert_settings` |

### Persistence Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| Demo | No Supabase env | In-memory `flow-store`, localStorage for packages |
| Supabase | Env configured | Users, projects, org, QA, metrics, settings persist to DB |
| Hybrid | Partial config | Some entities DB-backed, work packages may still use flow-store paths |

---

## Key Engines

| Engine | Path | Function |
|--------|------|----------|
| Forecast | `src/lib/forecast/engine.ts` | Document-based due dates, complexity multipliers |
| Workflow | `src/lib/workflow/` | Status transition dispatch |
| Workload alerts | `src/lib/workload-alerts/engine.ts` | Low capacity, snooze, dismiss |
| Help flags | `src/lib/help-flags/engine.ts` | Employee escalations |
| Work visibility | `src/lib/work-visibility/engine.ts` | Activity gaps, compliance % |
| Wrap-up | `src/lib/wrap-up/` | Daily reports, compliance gate |
| Project metrics | `src/lib/metrics/` | Custom KPIs, formulas, executive rollup |
| Command center | `src/lib/data/command-center.ts` | Executive dashboard aggregation |
| System health | `src/lib/system-health/integrity.ts` | Integrity checks |
| Hierarchy rollups | `src/lib/hierarchy/rollups.ts` | Progress, hours, QA stats per level |

---

## Server Actions Map

| Action file | Domain |
|-------------|--------|
| `crud.ts` | Projects, manufacturers, years, work packages, files |
| `qa.ts` | QA review submission |
| `employee.ts` | Wrap-up submit, employee actions |
| `clock.ts` | Shift clock in/out |
| `production.ts` | Task timers, uploads |
| `users.ts` | User CRUD |
| `departments.ts` | Department/team CRUD |
| `positions.ts` | Org chart positions |
| `forecast-settings.ts` | Forecast config |
| `workload-alerts.ts` | Workload alert config |
| `work-visibility-settings.ts` | Visibility config |
| `company-documents.ts` | SOP uploads |
| `help-flags.ts` | Help flag actions |
| `wrap-up.ts`, `wrap-up-review.ts` | Wrap-up compliance and review |
| `project-metrics.ts` | Custom metric CRUD |
| `notifications.ts` | Workflow checks |

All mutations call `revalidatePath()` on affected routes.

---

## Hierarchy Scoping

Managers and team leads see data filtered by reporting branch:

- `getVisibleUserIds(viewer)` — `src/lib/hierarchy/resolver.ts`
- `getScopeMemberIds()` — `src/lib/auth/team-scope.ts`

Applied across Operations, Reports, Alert Center, Wrap-ups, People, etc.

**Org-wide roles:** admin, super_admin, senior_manager (with `work:view_all`), viewer.

---

## Authentication Flow

```
/login → Supabase signIn OR demo user select
       → session cookie
       → redirect getDefaultRoute(role)

/auth/callback → OAuth/magic link code exchange
/auth/signup → Employee self-registration (Supabase only)
/auth/forgot-password → Reset email
/auth/reset-password → Set new password
```

---

## Integrations

| Integration | Usage |
|-------------|-------|
| Supabase Auth | User authentication |
| Supabase PostgreSQL | Persistent entities |
| Supabase Storage | Company documents, file uploads |
| Vercel | Hosting and deployment |

No external third-party PM, CRM, or email integrations beyond Supabase auth emails.

---

## Revalidation Graph

Work package mutations typically revalidate:
`/operations`, `/executive`, `/people`, `/project-health`, `/qa-center`, `/reports`, `/production`, `/work`, `/alert-center`

Project mutations additionally revalidate `/projects`, `/planning`.

---

## Build & Deploy

```bash
npm run build    # Next.js production build
npm run migrate:pending  # Apply Supabase migrations
```

Environment variables (typical):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (admin user operations)

---

## Code Map by Feature

| Feature | Primary Files |
|---------|---------------|
| Permissions | `src/lib/auth/permissions.ts` |
| Projects UI | `src/components/projects/project-workspace.tsx` |
| Task creation | `src/components/work-creation/create-task-composer.tsx` |
| Board creation | `src/components/work-creation/create-board-wizard.tsx` |
| Project creation | `src/components/work-creation/program-builder.tsx` |
| Operations board | `src/components/operations/` |
| Employee workspace | `src/components/employee/employee-workspace-view.tsx` |
| Executive dashboard | `src/components/executive/executive-dashboard-view.tsx` |
| QA | `src/app/(app)/qa-center/page.tsx`, `src/app/actions/qa.ts` |
| Org chart | `src/components/hierarchy/org-chart-view.tsx` |
| Custom metrics | `src/lib/metrics/`, `src/components/projects/project-metrics-panel.tsx` |

---

## Known Architectural Notes

1. **Dual storage** — Work packages primarily in `flow-store`; production events in separate store; sync via `production-bridge.ts`.
2. **No `/projects/[id]` route** — Project detail is in-page sheet, not deep-linkable URL.
3. **Cookie settings** — Work visibility settings not in Supabase (see SYSTEM_HEALTH_AUDIT).
4. **Year work items** — Some read paths not fully Supabase-backed.
5. **Metrics dual hydration** — Memory store + optional DB via `project-metrics-db.ts`.

---

*Feature inventory: [FEATURE_REFERENCE.md](./FEATURE_REFERENCE.md) · Operations manual: [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md)*
