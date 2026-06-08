# Flow

Workforce productivity platform for Service Info analyst teams. Unified hierarchy: **Project → Manufacturer → Year → Work Package**.

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

1. Copy `.env.local.example` → `.env.local` and set Supabase URL, anon key, `NEXT_PUBLIC_SITE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. Set `NEXT_PUBLIC_FLOW_DEMO_MODE=false`.
3. Run migrations in `supabase/migrations/` (including `002_auth_users.sql`).
4. In Supabase **Authentication → URL configuration**, add redirect URLs: `http://localhost:3000/auth/callback` (and your production URL).
5. Create the first admin in Supabase **Authentication → Users** (or SQL), then set `public.users.role = 'admin'` for that user id.

| Route | Purpose |
|-------|---------|
| `/login` | Email/password sign-in |
| `/auth/forgot-password` | Request reset email |
| `/auth/reset-password` | Set password after invite or reset |
| `/settings/users` | Invite users and change roles (admin) |

Roles (Admin, Manager, QA, Employee, Viewer) control which routes and nav items each user can access. Employees land on `/work`; others see manager/QA/executive views per `src/lib/auth/permissions.ts`.
