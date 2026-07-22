# Flow

Workforce productivity platform for Service Info analyst teams. Unified hierarchy: **Project → Manufacturer → Year → Work Package**.

> **Contributing?** Read [CONTRIBUTING.md](CONTRIBUTING.md) (workflow + setup)
> and [ARCHITECTURE.md](ARCHITECTURE.md) (how the app works + The Rules)
> before your first change. All changes go through pull requests; nobody
> pushes `main` or deploys except the owner.

## Quick start

```bash
cd flow
npm install
npm run dev
```

Open [http://localhost:3000/operations](http://localhost:3000/operations) — the Operations Board is the primary daily screen.

## Views

| Route | Purpose |
|-------|---------|
| `/operations` | **Operations Board** — expandable tree, inline status/assignment |
| `/executive` | Team Flow Score, project health, attention list |
| `/people` | Analyst performance & scorecards |
| `/project-health` | Per-project progress, hours, QA, projections |
| `/qa-center` | Review queue |
| `/reports` | Hierarchy-based reporting |

## Flow Score

- **40%** productivity (completions + hours today)
- **30%** quality (QA pass rate minus corrections)
- **20%** on-time completion
- **10%** activity / participation

## Sample data

Projects: SF Phase 1 2026, ADAS 2026, SI Corrections  
Manufacturers: Toyota, Honda, Ford, Nissan, Mercedes, BMW  
Analysts: Michael J, Tara, Tyler, Rai, Desi, Jacob

## Supabase authentication

### 1. Create a Supabase project

At [supabase.com](https://supabase.com) → **New project** → note your **Project URL** and **API keys** (Settings → API).

### 2. Local environment

Copy `.env.local.example` → `.env.local` and set:

| Variable | Where to find it |
|----------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role (server only) |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` locally |
| `NEXT_PUBLIC_FLOW_DEMO_MODE` | **`false`** |

Verify: `npm run check:supabase` then `npm run dev` → `/login` should show email/password (not demo user picker).

### 3. Run database migrations

In Supabase **SQL Editor**, run each file in `supabase/migrations/` **in numeric order** (`001` through `018`). Wait for each to succeed before the next.

### 4. Auth redirect URLs

**Authentication → URL configuration** → add:

- `http://localhost:3000/auth/callback`
- Your production URL + `/auth/callback` when deployed

**Authentication → Providers → Email** → enable **Sign up** if employees should create their own basic accounts at `/auth/signup`. New self-service users are always created as **employees** and must be assigned department, team, and supervisor in **Settings → Users** before they can work.

### 5. First admin user

1. **Authentication → Users → Add user** (email + password), or sign up once via `/login`.
2. **Table Editor → `users`** → set `role` to `admin` for that user’s row.
3. Sign in again — you should see admin nav and **Settings → Users**.

### 6. GitHub / production deploy

Add the same env vars to your host (e.g. Vercel). Set `NEXT_PUBLIC_SITE_URL` to your live domain and add that callback URL in Supabase.

**Production behavior:** When `NEXT_PUBLIC_FLOW_DEMO_MODE=false` and Supabase keys are set, Flow uses **real auth and user profiles** from Supabase. Sample mock employees, projects, and tasks are **not** loaded — you start with a clean operations workspace. Create departments, teams, and users via **Settings**.

Run `npm run setup:supabase` with `FLOW_ADMIN_EMAIL` set to preserve your admin login (Manager org position + Admin system access).

**Demo mode:** Set `NEXT_PUBLIC_FLOW_DEMO_MODE=true` (or omit Supabase keys) to run locally with full sample data and the demo user picker.
