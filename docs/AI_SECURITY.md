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

| Feature | Entry point | Model | Sends to API | Gate |
| --- | --- | --- | --- | --- |
| Ask Flow (help Q&A) | `src/app/actions/ask-flow.ts` | claude-opus-4-8 | User question + manual excerpts (public docs content) | `requireUser` |
| Findings Triage | `src/app/actions/ai-triage.ts` | `AI_MODELS.standard` | Allowlisted finding fields (`TRIAGE_FINDING_FIELDS` in `src/lib/ai/triage.ts`) + capped evidence | `validation:run` to spend, `validation:view` to read |

Add a row here for every new AI feature. Ask Flow predates the foundation layer and
should migrate to `getAiClient` + `logAiUsage` when next touched.

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
