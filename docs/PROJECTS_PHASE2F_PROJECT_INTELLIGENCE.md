# Project Intelligence (Phase 2F)

**Date:** June 2026  
**Scope:** Trend snapshots, health score breakdown, department capacity overlay, Project Health unification

---

## 1. Summary

Phase 2F extends the Smart Project System (Phase 2D) with **trend tracking**, **transparent score breakdown**, **department-level portfolio overlays**, and **Program Intelligence on the Project Health page**.

---

## 2. Engine extensions

| Module | `src/lib/projects/project-intelligence.ts` |
|--------|---------------------------------------------|

**New outputs:**
- `healthBreakdown` on `ProgramIntelligence` — factor list with point impacts
- `DepartmentIntelligence` — per-department avg health, capacity, at-risk counts
- `departmentBreakdown` on `PortfolioIntelligenceSummary`
- `buildPortfolioIntelligenceWithDepartments()` — portfolio summary with named departments

| Module | `src/lib/projects/intelligence-snapshots.ts` |
|--------|-----------------------------------------------|

**Client-side daily snapshots** (localStorage, one point per calendar day, 30-day history):
- `recordProgramSnapshot` / `recordPortfolioSnapshot`
- `getProgramTrend` / `getPortfolioTrend`
- `trendDelta` for period-over-period change

---

## 3. UI integration

| Surface | Component | Behavior |
|---------|-----------|----------|
| `/projects` portfolio | `PortfolioIntelligenceStrip` | 14-day portfolio trend, department overlay, delta badge |
| `/projects/[id]` | `ProgramIntelligencePanel` | Program trend chart + score breakdown |
| `/project-health` | `ProjectHealthIntelligenceRow` | Intelligence banner per project card |
| Hook | `useIntelligenceSnapshots` | Records snapshots on portfolio/program views |

---

## 4. Deep links

- `projectHealthHref({ projectId })` — scroll/highlight single project on Project Health

---

## 5. Verification

- [x] Intelligence engine extensions + snapshot lib
- [x] UI components wired
- [x] Unit tests (`project-intelligence.test.ts`, `intelligence-snapshots.test.ts`)
- [ ] Manual: revisit portfolio daily to build trend chart
- [ ] Manual: department overlay shows multiple departments

---

## 6. Future

- Persist snapshots to DB (`project_intelligence_snapshots`) for cross-device trends
- Department filter from overlay click → portfolio filter chip

---

*Phase 2F — Project Intelligence*
