# Smart Project System (Phase 2D)

**Date:** June 2026  
**Scope:** Program Intelligence — health scoring, capacity overlays, portfolio attention routing

---

## 1. Summary

The Smart Project System adds a unified **Program Intelligence** layer across the portfolio and individual program pages. It scores program health, estimates team capacity load, surfaces signals, and routes managers to the next best action.

---

## 2. Intelligence engine

| Module | `src/lib/projects/project-intelligence.ts` |
|--------|---------------------------------------------|

**Per-program output (`ProgramIntelligence`):**
- **Health score** (0–100) — forecast status, overdue/stuck work, structure gaps, capacity
- **Risk tier** — Healthy · Watch · At Risk · Critical
- **Capacity load %** — remaining hours vs assignee 10-day window
- **Signals** — overdue, QA queue, missing tasks, forecast late, etc.
- **Primary insight** + **next action** (reuses portfolio next-action logic)

**Portfolio summary (`PortfolioIntelligenceSummary`):**
- Average health score & capacity load
- Tier counts (healthy / watch / at risk / critical)
- Top attention programs (lowest health scores)

---

## 3. UI integration

| Surface | Component | Behavior |
|---------|-----------|----------|
| `/projects` portfolio | `PortfolioIntelligenceStrip` | Smart Project System strip above filters |
| `/projects` cards | `ProgramHealthBadge` on cards | Score + tier + insight + color border |
| `/projects/[id]` | `ProgramIntelligencePanel` | Full intelligence panel above structure tree |

---

## 4. Verification

- [x] Intelligence engine + UI components
- [x] Build passes
- [ ] Manual: portfolio strip shows tier counts
- [ ] Manual: program page panel links to Operations + Project Health

---

## 5. Future enhancements

- [x] Persist intelligence snapshots for trend charts (client localStorage — Phase 2F)
- [x] Department-level capacity overlay on portfolio KPIs (Phase 2F)
- [x] Ops URL `?projectId=` filter wiring (Phase 2E)

---

*Phase 2D — Smart Project System v1*
