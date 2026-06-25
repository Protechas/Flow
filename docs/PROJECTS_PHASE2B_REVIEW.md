# Projects Phase 2B — Portfolio UX & Operations Task Views

**Date:** June 2026  
**Scope:** Phase 2B only (portfolio cards + Operations task-first views)  
**Prerequisite:** Phase 2A Program Builder + migration `031` applied

---

## 1. Executive Summary

Phase 2B delivers two UX upgrades:

1. **Portfolio program cards** — `/projects` defaults to a card grid; **Structure** tab keeps the expandable hierarchy for power users.
2. **Operations task-first views** — `/operations` defaults to **Today**; **By Program**, **By Person**, and **Hierarchy** remain one click away.

Legacy **Create Project** and **Bulk Y/M/M** wizards were deleted (Program Builder is the sole program-creation path).

---

## 2. What Was Implemented

### 2.1 Portfolio program cards

| Item | Detail |
|------|--------|
| **Component** | `src/components/projects/project-portfolio-cards.tsx` |
| **Default view** | Card grid on `/projects` (`?view=structure` for tree) |
| **Toggle** | **Programs** \| **Structure** in portfolio toolbar |
| **Card actions** | Open program (`/projects/{id}`) · View structure (switches to tree + expands) |

### 2.2 Operations task-first views

| View | Behavior |
|------|----------|
| **Today** (default) | Open tasks due today or overdue |
| **By Program** | Tasks grouped by program name |
| **By Person** | Tasks grouped by assignee (unassigned last) |
| **Hierarchy** | Existing tree (Work Browser / Table View) |

| Item | Detail |
|------|--------|
| **Module** | `src/lib/operations/task-views.ts` |
| **UI** | `src/components/operations/operations-task-view.tsx` |
| **URL** | `?grouping=by_program` \| `by_person` \| `hierarchy` (Today omits param) |

Task rows reuse Operations detail panel + package sheet on click. Bulk select/actions work in task-first modes.

---

## 3. Cleanup

- Deleted `create-project-wizard.tsx`, `bulk-year-make-model-wizard.tsx`
- Updated `SYSTEM_ARCHITECTURE.md`, `package.json` migrate script
- Migration `031` applied on remote Supabase

---

## 4. Still Open (Phase 2C / follow-up)

1. ~~**Typed tracking flags** — `qa_required`, `files_required` on WorkPackage~~ ✅ Phase 2C
2. ~~**Enterprise templates** in Program Builder step 1~~ ✅ Phase 2C
3. **Project Intelligence** — portfolio health scoring, capacity overlays
4. **Manual QA** — §9.14 checklist from Phase 2A review

See `PROJECTS_PHASE2C_REVIEW.md` for Phase 2C details.

---

## 5. Verification Checklist

- [x] Legacy wizards deleted; build passes
- [x] `/projects` card grid default; Structure tab works
- [x] `/operations` Today default; By Program / By Person / Hierarchy
- [ ] Manual QA: card → program page → structure tab round-trip
- [ ] Manual QA: ops task row opens detail panel + deep link `?package=`

---

## 6. File Index

**Added**

- `src/components/projects/project-portfolio-cards.tsx`
- `src/lib/operations/task-views.ts`
- `src/components/operations/operations-task-view.tsx`
- `docs/PROJECTS_PHASE2B_REVIEW.md`

**Deleted**

- `src/components/work-creation/create-project-wizard.tsx`
- `src/components/work-creation/bulk-year-make-model-wizard.tsx`

**Major edits**

- `src/components/projects/project-workspace.tsx`
- `src/components/operations/operations-board.tsx`
- `src/components/operations/operations-toolbar.tsx`
- `src/lib/navigation/deep-links.ts`
- `src/app/(app)/projects/page.tsx`, `operations/page.tsx`

---

*Phase 2B complete. Project Intelligence and typed tracking flags remain future work.*
