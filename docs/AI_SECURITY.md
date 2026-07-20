# AI Security Policy

Every AI feature in Flow follows the rules on this page. They exist so that adding AI
never means leaking data, surprising spend, or a slower app. Treat this like the
Tools-hub performance rule: a feature that can't satisfy all six rules doesn't ship.

## What leadership needs to know

- Flow calls the Claude API under **Anthropic's Commercial Terms**: API inputs and
  outputs are **contractually not used to train models**. This is the default — not a
  toggle. Reference: <https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training>
- API logs are retained by Anthropic for ~7 days for abuse monitoring, then deleted.
  Zero Data Retention is available if required. Reference:
  <https://platform.claude.com/docs/en/manage-claude/api-and-data-retention>
- The training-data risk to the company is **shadow AI** — employees pasting company
  content into personal/consumer chatbots. Building AI into Flow, behind our key and
  our terms, reduces that risk; it does not create it.
- If stricter posture is ever required, the same features can run through AWS Bedrock
  (data stays inside an AWS agreement; Anthropic never receives it).

## The six rules

1. **Server-side only.** The key is `ANTHROPIC_API_KEY` — never `NEXT_PUBLIC_`, never
   in client code. All API calls go through `src/lib/ai/client.ts`.
2. **Allowlisted fields only.** Every feature declares exactly which fields it sends,
   as a `const` array, and builds payloads with `pickFields` (`src/lib/ai/allowlist.ts`).
   Never pass whole records or spread objects into a prompt. Adding a field to an
   allowlist is a reviewed decision.
3. **Advisory output only.** Model output is displayed for human review. It never
   triggers writes, queries, or actions on its own. A malicious string inside analyzed
   content must only ever be able to produce a bad *suggestion*, never a bad *action*.
   **Sanctioned exception (Eddy Phase 2 scoped tools):** Eddy may execute a small,
   enumerated set of tool calls confined to the asking user's OWN data — today that is
   exactly the personal to-do list (`todo_add` / `todo_list` / `todo_complete` in
   `src/app/actions/eddy.ts`, backed by `src/lib/eddy/todos.ts`). Every tool is
   owner-scoped by `userId` at the lib layer and by RLS below it; the blast radius of
   a bad call is one user's own to-do list. Any new tool, or any tool that touches
   shared/company data, is a reviewed policy decision — not a pattern to copy freely.
4. **Explicit user action only.** No AI calls on page load, in background jobs, polling,
   or cron. The user clicks; the call runs; it ends. (Reading *stored* AI results on
   page load is fine — that's a normal scoped DB query.)
5. **Every call is metered.** Log via `logAiUsage` (`src/lib/ai/usage.ts`) →
   `ai_usage_log` table, attributable per feature and per user. A monthly spend cap is
   set in the Anthropic console as the backstop.
6. **Authorization parity.** An AI endpoint enforces the same permission checks as the
   page it serves. An AI summary must never reveal data the caller couldn't open
   directly. (Flow reads bypass RLS via the service-role client, so app-layer checks
   are the only gate — do not skip them.)

## Feature register

| Feature | Entry point | Model tier | Sends to API | Gate |
| --- | --- | --- | --- | --- |
| Ask Eddy (assistant chat) | `src/app/actions/eddy.ts` | `fast` (Haiku) | User's own messages + manual excerpts + allowlisted page-context summaries (`src/lib/eddy/page-context.ts`, built only after the same route-permission check the page enforces) | `requireUser`; conversations stored per-user with ownership checks + RLS |
| Eddy to-do tools (todo_add/list/complete) | `src/app/actions/eddy.ts` (tool loop inside Ask Eddy) | `fast` (Haiku) | Nothing extra — tools receive Eddy's own arguments; results are the user's own to-do rows | Rule 3 sanctioned exception: owner-scoped writes to the asking user's own list only (`src/lib/eddy/todos.ts` + RLS); bounded to 4 tool rounds |
| Meeting Notes digest | `src/app/actions/meeting-notes.ts` | `standard` (Sonnet) | Pasted transcript (capped 80k chars, never stored) + title/date | Leads+ (`TOOL_ROLES`); action items become tasks only through human approval |
| Eddy Task Builder | `src/app/actions/eddy-task-builder.ts` | `standard` (Sonnet) | User's interview messages + allowlisted catalog (project/analyst/team/template ids+names, forecast units) | Creation-mode permission gate; drafts execute only through existing wizard actions after human approval |
| QA submission Eddy review | `src/app/actions/content-checks.ts` (`eddyReviewSubmissionAction`) | `fast` (Haiku) | File name/claim + server-extracted PDF text + auto-check flags | Leads+ (`TOOL_ROLES`); manual button only; results stored for review, never drive QA verdicts |
| Findings Triage | `src/app/actions/ai-triage.ts` | `standard` (Sonnet) | Allowlisted finding fields (`TRIAGE_FINDING_FIELDS` in `src/lib/ai/triage.ts`) + capped evidence | `validation:run` to spend, `validation:view` to read |
| Document Review (Eddy on SOPs) | `src/app/actions/ai-sop-review.ts` | `standard` (Sonnet) | Allowlisted doc fields (`REVIEW_DOC_FIELDS` in `src/lib/ai/sop-review.ts`) + document text, capped | `company_documents:manage` |

Add a row here for every new AI feature.

**Model tier rule:** every feature uses the cheapest `AI_MODELS` tier that does its
job well — `fast` (Haiku) for grounded Q&A/summaries/formatting, `standard` (Sonnet)
for clustering/drafting over many records, `reasoning` (Opus) only for genuinely hard
one-off work like rule compilation. Escalate a tier only with evidence the output is
weak, never "just in case."

## Checklist for a new AI feature

- [ ] Calls go through `getAiClient()`; feature is invisible when `isAiEnabled()` is false
- [ ] Field allowlist declared as a `const` array; payload built with `pickFields`
- [ ] Free-form text capped with `capText`
- [ ] Output rendered for review only; no writes driven by model output
- [ ] Triggered by explicit user action; nothing on page load or in background
- [ ] `logAiUsage` called with a stable feature slug
- [ ] Permission check matches the surface it lives on
- [ ] Row added to the feature register above

## If the key leaks

Rotate it in the Anthropic console, update the Vercel env var, redeploy. The key grants
API spend only — it cannot read Flow data.
