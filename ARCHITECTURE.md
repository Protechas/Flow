# Flow — Architecture

Flow is a production-workforce platform (projects, tasks, time clock, QA,
daily/weekly reporting, AI assistant) for Protech teams. One Next.js app,
one Postgres database, one deploy. This document is the map — read it before
your first change, and read **The Rules** twice.

## Stack

- **Next.js (App Router) + TypeScript + React** — server components by default,
  client components where interaction demands it.
- **Supabase** — Postgres + auth + storage. No ORM; queries go through
  `@supabase/supabase-js`.
- **Tailwind + shadcn-style UI** in `src/components/ui`.
- **Vitest** (unit), **Playwright** (e2e), custom contract checks in `scripts/`.
- **Vercel** — production hosting. Deploys are **manual and owner-only**; see
  Deployment below.

## Repo layout

```
src/app/(app)/…        Authenticated app routes (server components)
src/app/(employee)/…   Employee-facing routes (/work is the employee home)
src/app/actions/…      Server actions — ALL writes go through these
src/components/…       React components, grouped by feature
src/lib/…              Domain logic. Pure where possible; this is where tests live
src/lib/data/…         The store + Supabase hydration/persistence layer
supabase/migrations/   Numbered SQL migrations (append-only)
scripts/               Contract checks, migration runner, diagnostics, smoke
e2e/                   Playwright specs
```

## The data model: one in-memory store

The single most important thing to understand: **server code does not query
the database per request.** A module-level in-memory store
(`src/lib/data/flow-store.ts` + `production-tracking.ts`) holds users, teams,
projects, tasks, time entries, uploads, etc. It is hydrated from Supabase by
`ensureAppDataLoaded()` (`src/lib/data/app-hydrate.ts`) with a **45-second
TTL cache** (`hydration-cache.ts`).

- **Reads** come from the store (synchronous, fast, possibly ≤45s stale).
- **Writes** update the store *and* persist to Supabase (`persist*` functions
  in `src/lib/data/*-db.ts`). Server actions await the persist so data
  survives the next page load.
- Store state is per server instance. Do not treat it as a source of truth
  across instances — Supabase is the truth; the store is a cache.

This "load everything" pattern is scheduled for a scoped-queries rework (P5).
Until then: every new hydrator you add is a tax every page pays. Prefer
feature-scoped fetches (see `upload-events-db.ts` for the pattern) for data
only one page needs.

## Demo mode is a fork

`NEXT_PUBLIC_FLOW_DEMO_MODE=true` (or missing Supabase env) runs the entire
app against in-memory mock data (`src/lib/data/mock-data.ts`). Auth becomes a
cookie (`flow_demo_user_id`), and **every `persist*` function silently
no-ops**. This is the zero-credential dev sandbox — and also a trap:

> A creation flow that persists children before their parent will look fine
> in demo mode and throw foreign-key errors in production, because demo mode
> never talks to the database. This has happened (bulk-matrix creation).
> **Test any new create/persist path against a real Supabase before shipping.**

## The team-workspace engine (operating models)

Teams are configured, not hardcoded. `TeamOperatingModel`
(`src/lib/operating-models/`) stores each team's way of working as data:
hierarchy labels, project/task types, forecast rules (incl. the counting
unit), task defaults, content-check + upload-gate toggles, per-team wrap-up
fields, workspace panels, manager Friday updates, employee weekly updates.

**When a team wants different behavior, add a config capability to the model
and render from it. Never write `if (team === "advanced-projects")`.** The
model row lives in `team_operating_models` (whole model serialized into the
`definition` JSONB column) and resolves via
`src/lib/operating-models/resolve.ts` (team binding → department → legacy
project-type map → general fallback).

## Auth & visibility

- No RLS. **Server code is the security boundary.** Every server action must
  start with `requireUser()` / `requirePermission()` /
  `assertCanEditWorkPackage()` — `npm run check:action-auth` enforces a
  subset, but the convention is absolute.
- Viewer scoping goes through `src/lib/auth/project-scope.ts`
  (`getVisibleProjectIds` — branch teams ∪ owned ∪ created; org-wide roles see
  all). Never invent a parallel scoping path; the persona contract tests in
  `project-scope.test.ts` are the spec.
- Timezone: always `src/lib/datetime/timezone.ts` helpers (`appTodayDate`,
  `appDayOfWeek`, `appCurrentHour`). Production runs UTC; the org runs
  America/Chicago. Raw `new Date()` day-boundary math is a bug.

## The Rules (each one is a scar)

1. **Persist whole objects.** Never hand-enumerate fields into a persisted
   row or a form round-trip. Enumerated field lists silently dropped
   `uploadGate`/`contentChecksEnabled` (and later nested `forecastRules`
   config) every time Settings saved. Pattern: spread the object, delete
   metadata keys (`src/lib/operating-models/persist-shape.ts`), and when a
   form edits part of an object, merge over the existing record.
2. **Any query that can exceed 1,000 rows must page.** PostgREST silently
   caps every response at 1,000 regardless of `.limit()`. This erased weeks
   of data from the ROI chart. Use the paging pattern in
   `production-tracking-db.ts` (`fetchAllRows`).
3. **`prefetch={false}` on links in card grids and lists.** Next.js prefetch
   turned one /projects render into a dozen concurrent page renders and took
   the app down to a crawl. Single contextual links may prefetch; grids never.
4. **Units are resolved, never hardcoded.** "Files" is one team's unit. Use
   `src/lib/forecast/units.ts` (`resolveProjectUnit`, `resolveTaskUnit`,
   `forecastUnitLabels`) anywhere a count is labeled.
5. **The counting unit ≠ the word "file."** Uploaded documents (upload zones,
   storage, gates) are always files; the *unit of work being counted* is
   team-configurable. Don't rename real file features.
6. **If `npm run build` fails with garbage type errors** in
   `.next/dev/types/…` after a dev server ran: delete `.next/dev` and
   rebuild. Known artifact-corruption gotcha.
7. **e2e has known flakes** (`critical-workflows`, auth-confirm connection
   refusals) under CPU contention. If CI or `npm run smoke` fails only there,
   re-run before assuming you broke something — and never run smoke with a
   dev server up.
8. **Follow `AGENTS.md`**: this Next.js version differs from what you (or
   your AI tools) remember. The bundled docs in `node_modules/next/dist/docs`
   are the reference.
9. **Cross-project boundary.** Other apps, agents, or AI sessions on this
   machine must never read Flow's `.env.local` or commit to this repo from
   outside its own workflow. External consumers (e.g. Athena, the owner's
   assistant) integrate through reviewed, secret-gated, read-only endpoints
   like `/api/athena/summary` — dormant unless their env key is set —
   and their changes go through the same review as any contributor's.

## Subsystem index (where things live)

| Area | Code |
|---|---|
| Time clock, timers, uploads, submissions | `src/lib/data/production-tracking*.ts`, `src/lib/time-clock/` |
| Daily wrap-ups (+ per-team sections) | `src/lib/wrap-up/`, `src/app/actions/employee.ts` |
| Weekly updates + manager Friday section | `src/lib/wrap-up/weekly-update.ts`, `manager-update.ts`, `src/lib/data/weekly-updates-db.ts` |
| Employee home / workflow | `src/app/(employee)/work/page.tsx`, `src/components/employee/` |
| Projects, boards, workspace config | `src/components/projects/`, `src/lib/projects/` |
| Forecast engine + units | `src/lib/forecast/` |
| QA center, rules, content checks | `src/lib/qa-center/`, `src/lib/content-checks/` |
| Notifications (bell + producers) | `src/lib/notifications/` |
| Eddy (AI) — READ `AI_SECURITY.md` first | `src/lib/ai/`, `src/lib/eddy/` |
| Visibility / permissions | `src/lib/auth/` |
| ROI / Monday-era baseline | `src/lib/legacy/`, `src/lib/validation-center/roi.ts` |

## Testing & gates

```
npm run test                 # vitest unit suite (fast, run constantly)
npm run lint                 # eslint — zero errors required
npm run check:persist        # persistence contract
npm run check:action-auth    # server-action auth contract
npm run build                # production build must pass
npm run smoke                # the full deploy gate (CI runs this)
```

A change is done when unit + lint + contracts + build are green. New logic in
`src/lib` ships with tests beside it (`foo.test.ts`).

## Deployment (owner-only)

Production is `flowproduction.space`, deployed **manually by the owner** with
`npx vercel --prod` from a trusted machine, after gates. Pushing to GitHub
does **not** deploy anything. Database migrations are applied manually with
`node --env-file=.env.local scripts/run-migration-files.mjs <file.sql>`
before the code that needs them ships. Contributors never deploy and never
hold production credentials — see CONTRIBUTING.md.
