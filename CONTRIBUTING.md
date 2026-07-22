# Contributing to Flow

Flow runs a real team's production day. People clock in, submit work, and get
paid based on what this app records. Treat every change accordingly.

## The golden rules

1. **Never push to `main`.** All changes arrive as pull requests from a
   branch (or fork). No exceptions, including "tiny" fixes.
2. **Never deploy.** Production deploys are done by the owner (@DustyEang),
   manually, after review. Merging a PR does not deploy anything — and that's
   intentional.
3. **Never commit secrets.** No API keys, no `.env.local`, no database URLs
   with credentials. CI runs on placeholders; your sandbox keys stay on your
   machine.
4. **Read `ARCHITECTURE.md` before your first change** — especially
   "The Rules." Every rule in there is a production incident we already paid
   for once.
5. **Database migrations get called out.** If your PR adds a file to
   `supabase/migrations/`, say so prominently in the PR description. The
   owner applies migrations to production by hand before merging code that
   needs them.

## Getting set up (no credentials needed)

```bash
git clone <the repo>
cd flow
npm ci
```

Create `.env.local` with just:

```
NEXT_PUBLIC_FLOW_DEMO_MODE=true
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000
```

```bash
npm run dev
```

That's the full app on `http://127.0.0.1:3000` against realistic mock data —
no database, no keys, nothing to break. Sign in happens automatically in demo
mode; use the persona switcher ("See Flow the way your team sees it") to view
as different roles.

**Demo mode's limits (important):** persistence functions no-op, so anything
touching *how data saves* (new tables, create flows, foreign keys) must also
be tested against a real database. For that, create your own free Supabase
project, put its URL/keys in your `.env.local` (with
`NEXT_PUBLIC_FLOW_DEMO_MODE=false`), and run
`npm run migrate:all` to build the schema. **You will never be given
production credentials — don't ask, it's not personal.**

## The workflow

1. Branch from latest `main`: `feat/short-description` or `fix/…`.
2. Make the change. Match the style of the surrounding code; comments only
   for constraints the code can't express.
3. New logic in `src/lib` gets a `*.test.ts` beside it.
4. Run the gates locally before pushing:
   ```bash
   npm run test && npm run lint && npm run check:persist && npm run check:action-auth && npm run build
   ```
5. Open a PR to `main`: what changed, why, how you verified it, and whether
   there's a migration. Screenshots for UI changes help a lot.
6. CI runs the full smoke gate on your PR. Known flake: if the *only* failure
   is the `critical-workflows` e2e spec or an auth-confirm connection refusal,
   re-run the job before digging.
7. The owner reviews and merges. Deploy happens separately.

## What not to touch without a conversation first

- `src/lib/auth/**` and the session/middleware code — the login-stability
  fixes in there are load-bearing.
- `AI_SECURITY.md` rules or anything that changes what Eddy is allowed to do.
- `scripts/run-migration*` / anything that writes to production data.
- Deleting or renaming existing exports that other features consume — search
  first (`src/lib/data/flow-store.ts` is imported everywhere).

## Questions

Ask Dusty (@DustyEang). A five-minute question beats a reverted PR.
