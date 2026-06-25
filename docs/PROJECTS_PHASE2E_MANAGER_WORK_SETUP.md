# Manager Work Setup (Phase 2E)

**Date:** June 2026  
**Scope:** Unified board + task creation for managers and team leads, with tracking defaults and Operations deep links

---

## 1. Summary

Phase 2E completes the **manager / team lead workflow** for building and tracking work:

- **New work** hub — one entry point for boards and tasks
- **Board tracking defaults** — QA and file requirements stored on the board and inherited by new tasks
- **Operations deep link** — `?projectId=` filters the board to a single program/board after creation

---

## 2. New Work hub

| Component | `ManagerWorkSetup` |
|-----------|-------------------|
| Surfaces | `/operations`, `/projects`, `/projects/[id]` |
| Who | Roles with both `board` and `task` creation modes (manager, team lead, admin, etc.) |

**Board path:** template → details & tracking → review → optional first task  
**Task path:** opens `CreateTaskComposer` with boards listed first

---

## 3. Board tracking defaults

| Module | `src/lib/work-creation/board-defaults.ts` |

Board descriptions embed machine-readable settings after a `— board:` marker:

- Template id, QA required, files required, default workstream
- Human-readable purpose line remains visible in UI
- **Task composer** reads board defaults when a board project is selected and pre-fills QA/files/workstream

---

## 4. Operations project filter

| URL | Example |
|-----|---------|
| `operationsHref({ projectId, grouping: "by_program" })` | `/operations?grouping=by_program&projectId=<uuid>` |

After board creation, users land on Operations filtered to that board in **By Program** view.

---

## 5. Verification

- [x] ManagerWorkSetup on Operations, Projects, Program detail
- [x] Board defaults persist + task composer inheritance
- [x] Ops `projectId` URL filter (toolbar sync + deep links)
- [x] CreateBoardWizard parity (tracking + optional first task)
- [x] Portfolio cards + structure rows: Ops link + Add task
- [x] Program Intelligence + portfolio attention strip → Operations by `projectId`
- [x] Task create redirects to Operations when launched from portfolio/hub
- [x] Build passes
## 6. Full workflow (Phase 2E completion)

| Capability | Status |
|------------|--------|
| New Work hub (Operations, Projects, Planning, Program detail) | Done |
| Board create with tracking + optional first task | Done |
| Board defaults persist + task composer inheritance | Done |
| Edit board tracking (purpose, QA, files, workstream) | Done |
| Ops `projectId` deep link + toolbar URL sync | Done |
| Portfolio/structure **Next action** chips → Ops or Add task | Done |
| Program Intelligence next action is clickable | Done |
| Board **QA on / Files on** badges on cards + intelligence | Done |
| Ops empty state **Add first task** when filtered to empty board | Done |
| Task create → redirect to Operations (portfolio/hub paths) | Done |
| Vitest unit tests (`npm test`) | Done |
| First-visit **New work** onboarding callout | Done |

### Run tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

### Onboarding

First time a manager/team lead sees **New work**, a callout explains board vs task paths. Dismiss with **Got it**, **Try it**, or by opening the hub. Stored per user in `localStorage` (`flow.new-work-onboarding.v1.<userId>`).

---

*Phase 2E — Manager Work Setup (complete)*
