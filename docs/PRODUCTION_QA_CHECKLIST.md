# Flow Production QA Checklist

Use this checklist before team rollout or after any production deploy to [flowproduction.space](https://flowproduction.space).

## Documentation (every deploy)

The operations manual is only useful if it never lies. Before promoting:

- [ ] `docs/OPERATIONS_MANUAL.md` — "What's New" covers this deploy's
      user-visible changes; affected sections updated
- [ ] Role guides updated if workflows changed (Employee / Team Lead /
      Manager / Administrator)
- [ ] `docs/TROUBLESHOOTING.md` updated if a known failure mode changed
- [ ] "Last updated" date bumped in the manual header

Run automated gate first:

```bash
cd flow
npm run smoke              # CI gate: unit tests, build, config, e2e
npm run check:config       # env vars (use --env-file=.env.local in prod)
npm run check:migrations   # schema vs app expectations (requires DB password)
npm run verify:production  # Vercel + domain linkage
npm run verify:supabase    # remote Supabase health
```

Open **Admin → System Health** and confirm zero critical items.

---

## Bug severity (triage)

| Level | Examples | Blocks rollout? |
|-------|----------|-----------------|
| **P0** | Cannot login, cannot clock in/out, app down, data loss | Yes |
| **P1** | Cannot create/assign/complete work, permissions broken, wrong reports | Yes |
| **P2** | Broken button, stale data, visual glitch | No |
| **P3** | Copy, polish, minor layout | No |

---

## Auth

- [ ] Login page loads without server error
- [ ] Existing user can log in with email + password
- [ ] Invalid credentials show friendly error (not generic Next.js crash)
- [ ] New user signup works (or signup is intentionally disabled)
- [ ] Signup creates `public.users` profile (check System Health → no missing profiles)
- [ ] Default role is `employee` for self-signup
- [ ] Admin invite email sends and link opens `/auth/confirm`
- [ ] Invite acceptance lands on set-password or intended page
- [ ] Forgot password email sends and reset completes
- [ ] Password reset works on **production URL**, not localhost
- [ ] Supabase Site URL = `https://flowproduction.space`
- [ ] Redirect URLs include `/auth/confirm/**` and `/auth/callback/**`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` set in Vercel production
- [ ] `NEXT_PUBLIC_FLOW_DEMO_MODE=false` in production

---

## Clock

- [ ] Hourly employee can clock in from `/work`
- [ ] Employee cannot clock in twice (clear error)
- [ ] Employee can clock out (lunch + end of day)
- [ ] Wrap-up required before clock-out when rule applies
- [ ] Active task timer stops on clock-out
- [ ] Clock state persists after page refresh
- [ ] Manager sees employee clock status on time clock / reports
- [ ] Salary employee is not forced to use shift clock (if applicable)

---

## Tasks

- [ ] Create task from operations / project
- [ ] Assign task to employee
- [ ] Task appears on employee `/work`
- [ ] Start task timer
- [ ] Pause / resume / stop timer
- [ ] Upload file to task
- [ ] Submit task to QA
- [ ] Reassign task
- [ ] Task status updates on manager operations view
- [ ] Project progress / forecast updates after task work

---

## Projects

- [ ] Create project or program
- [ ] Open `/projects/[id]` without error
- [ ] Add task to project
- [ ] Project page reflects new task immediately
- [ ] Refresh keeps same data (no stale in-memory-only state)
- [ ] KPIs / forecast fields load

---

## QA

- [ ] QA reviewer can open QA center
- [ ] Approve submission
- [ ] Request correction / reject
- [ ] Employee sees correction status on task

---

## Files

- [ ] Upload within size limit succeeds
- [ ] Oversized file shows friendly error
- [ ] File appears on task after upload

---

## Daily wrap-up

- [ ] Employee can submit end-of-day wrap-up
- [ ] Wrap-up persists after refresh
- [ ] Manager can review wrap-up
- [ ] Clock-out blocked when wrap-up missing (hourly)

---

## Reports & dashboards

- [ ] Employee dashboard (`/work`) loads
- [ ] Manager operations dashboard loads
- [ ] Admin system health loads
- [ ] Reports show current data (not demo / stale)

---

## Permissions

- [ ] Employee cannot access `/settings`
- [ ] Employee cannot access `/system-health`
- [ ] Employee cannot access other users' restricted work
- [ ] Team lead sees team scope only
- [ ] Manager sees department/team scope
- [ ] Admin sees all
- [ ] Direct URL to forbidden page redirects to `/unauthorized` or login

---

## Deployment

- [ ] `npm run smoke` passes locally or in CI
- [ ] `npm run build` passes
- [ ] `npm run check:migrations` passes against production DB
- [ ] Vercel production deploy is Ready
- [ ] Custom domain aliases correctly
- [ ] No secrets in client bundle
- [ ] Post-deploy: run smoke auth + clock test with real user

---

## Post-rollout monitoring

- [ ] Check Vercel logs for `[flow-action]` errors after first hour
- [ ] System Health: zero critical integrity issues
- [ ] No open clock entries stuck > 24h (warning in System Health)
- [ ] No auth users without profiles

---

## Automated test coverage (repo)

| Layer | Command | Covers |
|-------|---------|--------|
| Unit | `npm run test` | Permissions, wrap-up compliance, auth redirects, error messages |
| E2E smoke | `npm run test:e2e` | Login, auth routes, demo login |
| E2E critical | `e2e/critical-workflows.spec.ts` | Admin/manager/employee flows, clock, permissions, create project/task |
| E2E Supabase (optional) | `npm run test:e2e:supabase` with `.env.staging.e2e.example` | Real login, signup pages, auth routes on staging |
| Deploy gate | `npm run smoke` | Lint + unit + build + config + e2e |

Supabase-specific auth/invite tests require staging credentials (`RUN_SUPABASE_E2E=true`) — run manually before major auth changes.
