# Production Hardening (Phase 2G)

**Date:** June 2026  
**Scope:** Persistence, auth fixes, intelligence DB, settings admin, E2E smoke tests

---

## Summary

Phase 2G addresses production-readiness gaps from the app review: Supabase persistence for workforce data, settings, and intelligence snapshots; auth allowlist fixes; unified at-risk filtering; department overlay filtering; Playwright smoke tests.

---

## Changes

### Persistence (Supabase)

| Data | Module | Hydrated via |
|------|--------|--------------|
| Clocks, timers, uploads, submissions, QA records | `production-tracking-db.ts` | `ensureAppDataLoaded()` |
| Daily wrap-ups + overrides | `wrap-ups-db.ts` | `ensureAppDataLoaded()` |
| Work visibility settings | `supabase-settings.ts` + migration `033` | `hydrateWorkVisibilitySettings()` |
| Intelligence snapshots | `app/actions/intelligence-snapshots.ts` + migration `033` | Server actions on portfolio/program views |

**Migration:** `033_platform_persistence.sql` — run via `npm run migrate:pending`

### Auth & access

- `senior_manager` → `/people`
- `super_admin` → `/qa-center`
- `teamlead` → `/project-health` (+ `dashboard:view` permission)
- Route tests: `permissions.test.ts`

### Intelligence & portfolio

- Department overlay click → filters portfolio by department
- Project Health `?risk=at_risk` uses intelligence tiers when available
- Dual-write snapshots: localStorage + Supabase

### Settings

- New `/settings/help-flags` admin page with Supabase persistence
- Work visibility settings persist to Supabase when configured

### Tests

- 27 Vitest unit tests (was 22)
- Playwright smoke: `npm run test:e2e` (`e2e/smoke.spec.ts`)

---

## Still manual

- Full Phase 2 browser QA checklist (`PROJECTS_PHASE2_REVIEW.md` §9.14)
- Apply migrations `031`, `032`, `033` on production Supabase

## Deferred

- Replace native `confirm()` dialogs with accessible AlertDialog
- Split `operations-board.tsx` into smaller modules

---

*Phase 2G — Production hardening*
