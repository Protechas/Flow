# Phase 1 Validation Audit

**Date:** June 2026  
**Method:** Static code audit + production build verification. No feature changes. No runtime/manual browser QA executed in this session.  
**Build:** `npm run build` — **PASS**  
**Automated test suite:** **None exists** in repository

---

## Verdict

**Phase 1 is structurally sound but not fully validated.**

| Gate | Status |
|------|--------|
| Compile / typecheck | ✅ Pass |
| Task creation unified to Composer (header flows) | ✅ Pass |
| Duplicate drawer/wizard removed | ✅ Pass |
| Smart labels on Phase 1 target surfaces | ⚠️ Partial |
| Canonical `/projects/[id]` routing | ✅ Pass |
| Cache revalidation for program detail | ❌ Fail |
| Dead code cleanup | ❌ Fail |
| Manual end-to-end QA | ⏸ Not run |

**Recommendation:** Do **not** begin Phase 2 until manual QA checklist completes and revalidation + dead-code items are addressed.

---

## 1. Passed Tests (Static Verification)

### Task creation paths

| Check | Result | Evidence |
|-------|--------|----------|
| Single `createQuickTaskAction` entry from UI | ✅ | Only `create-task-composer.tsx` imports it |
| Composer mounted on `/projects` | ✅ | `projects/page.tsx` when `allowedModes` includes `task` |
| Composer mounted on `/operations` | ✅ | `operations/page.tsx` |
| Composer mounted on `/projects/[id]` with `defaultProjectId` | ✅ | `projects/[id]/page.tsx` |
| Backend chain intact | ✅ | `crud.ts` → `createQuickTask` → `persistQuickTaskChain` |
| Placement inference wired | ✅ | `task-placement.ts` used by Composer |
| Forecast inputs passed on create | ✅ | `estimatedDocumentCount`, `complexityLevel`, `manualDueDate` |
| QA/files flags appended to notes | ✅ | Prose flags (pre-existing pattern) |
| `CreateTaskDrawer` removed | ✅ | File deleted; zero imports |
| `NewWorkWizard` removed | ✅ | File deleted; zero imports |
| Board creation extracted | ✅ | `CreateBoardWizard` on Projects + Operations |

### Assignment paths

| Check | Result | Evidence |
|-------|--------|----------|
| Assign quick-create removed | ✅ | `assign-task-dialog.tsx` — existing tasks only |
| Assign uses `updateWorkPackageAction` | ✅ | Sets `assigned`, `assigned_to`, optional due/notes |
| Assign mounted on Operations only | ✅ | `AssignTaskTrigger` on operations page |
| Button renamed to "Assign existing" | ✅ | Clarifies vs Create task |
| Permission gate | ✅ | `canAssignWork` + not read-only |

### Forecast update paths (unchanged by Phase 1)

| Check | Result | Evidence |
|-------|--------|----------|
| Composer client preview | ✅ | `calculateTaskForecast` in Composer |
| Package create applies forecast fields | ✅ | `createWorkPackage` in `create-work-setup.ts` |
| `AddWorkPackageDialog` forecast preview | ✅ | Still uses `calculateTaskForecast` + `TaskImpactReview` |
| Live forecast / production bridge | ✅ | Not modified in Phase 1 |
| `afterWorkMutation` revalidation | ✅ | `crud.ts` PATHS include `/planning`, `/reports`, etc. |

### Project update paths

| Check | Result | Evidence |
|-------|--------|----------|
| Portfolio + workspace CRUD | ✅ | `project-workspace.tsx` unchanged actions |
| Program detail page loads scoped data | ✅ | `[id]/page.tsx` filters mfr/year/packages |
| Project name links to `/projects/[id]` | ✅ | `project-workspace.tsx` |
| Legacy query redirect | ✅ | `projects/page.tsx` redirects `?projectId=` / `?highlight=` |
| `projectsHref()` canonical | ✅ | `deep-links.ts` → `/projects/{id}` |
| Planning + calendar links | ✅ | Updated to `/projects/{id}` |
| Template redirect | ✅ | `templates.ts` → `/projects/{id}` |

### QA workflow (unchanged)

| Check | Result | Evidence |
|-------|--------|----------|
| QA submit / review actions | ✅ | Not modified |
| QA deep links | ✅ | `operationsHref({ package })`, `qaCenterHref` |
| Composer QA default `true` | ✅ | Notes prose `"QA required"` |

### Reporting workflow (unchanged)

| Check | Result | Evidence |
|-------|--------|----------|
| Rollup engine | ✅ | Not modified |
| Reports / executive / health data paths | ✅ | Not modified |
| Operations tree build | ✅ | Not modified |
| `operationsHref({ projectId })` filter | ✅ | `board-filters.ts` supports `projectId` |

### Label rendering (Phase 1 targets)

| Surface | Result |
|---------|--------|
| Operations board project rollup line | ✅ `structureCountSummary` + per-project `projectType` |
| Operations dialogs (add structure) | ✅ `projectType` prop |
| Operations toolbar search/filter | ✅ Generic smart defaults |
| Operations detail panel headers | ✅ Type-aware where `projectType` passed |
| Portfolio detail sheet | ✅ `getHierarchyLabels(project?.project_type)` |
| Projects workspace structure dialogs | ✅ `labels={getHierarchyLabels(project.project_type)}` |
| Employee task detail fields | ✅ Smart label keys for workstream/phase |
| Page copy (Projects / Operations headers) | ✅ Neutral program language |

---

## 2. Failed Tests

### Critical

| ID | Finding | Impact |
|----|---------|--------|
| F-01 | **`revalidatePath` does not include `/projects/[id]`** | Mutations call `revalidateAll()` with static `/projects` only. Program detail page may show stale tree until hard refresh. |
| F-02 | **No automated tests; manual QA not executed** | Phase 1 claims untested in browser (create, assign, ADAS vs SI labels, redirect). |

### Moderate

| ID | Finding | Impact |
|----|---------|--------|
| F-03 | **`StructurePreviewPanel` ignores project type** | Calls `getHierarchyLabels()` with no args while `buildStructurePreview` uses draft type. Create Project wizard review step may show wrong labels for non-SI types. |
| F-04 | **Second task-creation UX remains** | `AddWorkPackageDialog` → `createWorkPackageAction` (in-tree add). Not Composer; different fields/flow. Violates spirit of "one task workflow" for tree-based adds. |
| F-05 | **Duplicate `AddManufacturerDialog` implementations** | `operations-dialogs.tsx` AND local copy in `project-workspace.tsx` (~150 lines duplicated). |
| F-06 | **Operations bulk delete copy** | `confirm('Delete N work packages?')` — hardcoded, not smart labels. |

### Low

| ID | Finding | Impact |
|----|---------|--------|
| F-07 | **`highlightProjectId` prop orphaned** | Still on `ProjectWorkspace` but no caller passes it after redirect change. |
| F-08 | **`assign-task-dialog` unused prop** | `projects?: Project[]` in type comment area removed from usage but optional type remnant in dialog file — dead interface field. |
| F-09 | **Composer `requireAssignee` / controlled `open` unused** | API added but no consumer wires Assign → Composer. |
| F-10 | **`createQuickTask` error string** | Still says "Manufacturer name is required" (internal error, not UI). |

---

## 3. Broken Links

| Link pattern | Status |
|--------------|--------|
| `/projects?projectId=` | ✅ Redirects via `projects/page.tsx` |
| `/projects?highlight=` | ✅ Redirects |
| `/projects/{id}` in planning, calendar, templates, portfolio | ✅ Updated |
| Stale `?projectId=` in `src/` | ✅ None found |
| `operationsHref({ projectId })` | ✅ Supported by board filters |
| Deleted component imports | ✅ None (`CreateTaskDrawer`, `NewWorkWizard`) |

**Broken links found:** **0** (static analysis)

---

## 4. UI Inconsistencies

| Area | Issue | Severity |
|------|-------|----------|
| Create Project wizard review | `StructurePreviewPanel` uses default labels, not draft `projectType` | Medium |
| Operations toolbar structure filter | Generic labels across mixed project types on one board | Low |
| Operations detail panel | "Active tasks" list header — hardcoded English | Low |
| Operations bulk confirm | "work packages" in delete confirm | Low |
| Employee task list / QA returns | Shows `project · manufacturer.name · year` as data breadcrumb (not wrong data, no type-aware separators) | Low |
| Assign existing | Only on Operations, not Projects header | Low (may be intentional) |
| `EditManufacturerDialog` | Title "Edit {name}" — no smart label | Low |
| Board vs program in Composer dropdown | `filterProgramProjects` excludes boards unless fallback path | Low edge case |

---

## 5. Remaining Duplicate Workflows

### Task creation (2 UI paths → 2 backends)

| Path | UI | Backend |
|------|-----|---------|
| **Primary (Phase 1)** | `CreateTaskComposer` | `createQuickTaskAction` |
| **In-tree (legacy)** | `AddWorkPackageDialog` on Ops + Projects workspace | `createWorkPackageAction` |

### Project / program creation (unchanged; pre-Phase 2)

| Path | UI |
|------|-----|
| Create Project Wizard (6-step) | `create-project-wizard.tsx` |
| Bulk Y/M/M | `bulk-year-make-model-wizard.tsx` |
| Enterprise template | `createProjectFromTemplateAction` |
| Bulk add packages to existing | `bulk-work-packages-dialog.tsx` |

### Structure dialogs (duplicate components)

| Component | Locations |
|-----------|-----------|
| `AddManufacturerDialog` | `operations-dialogs.tsx` + `project-workspace.tsx` (local) |
| `AddYearDialog` / year flows | Operations dialogs + project workspace inline |

### Board creation

| Path | Status |
|------|--------|
| `CreateBoardWizard` | ✅ Single path (Phase 1) |

---

## 6. Remaining Hardcoded Labels

| Location | Text | Should be |
|----------|------|-----------|
| `operations-board.tsx:381` | "Delete … work packages?" | `{taskPlural}` |
| `operations-detail-panel.tsx:255` | "Active tasks" | `{taskPlural}` or smart |
| `operations-detail-panel.tsx:375` | "Tasks" (year panel list) | `{taskPlural}` |
| `structure-preview-panel.tsx:5` | `getHierarchyLabels()` no type | Pass `projectType` from preview |
| `create-work-setup.ts:40` | Error: "Manufacturer name is required" | Generic "Workstream/package name" or keep internal |
| `edit-manufacturer-dialog.tsx` | Generic "Name" field | Acceptable |
| `smart-labels.ts` / `hierarchy-labels.ts` | SI defaults in constants | By design |
| Employee list breadcrumbs | Raw `manufacturer.name` | Data OK; label context N/A |

**Phase 1 target surfaces:** largely fixed. **Gaps** concentrated in confirm dialogs, project wizard preview panel, and employee list chrome.

---

## 7. Remaining Dead Code

| Item | File | Notes |
|------|------|-------|
| `PROJECT_GUIDED_STEPS` | `project-guided-steps.ts` | **Zero imports** after `NewWorkWizard` deletion |
| `buildTaskPreview` | `preview.ts` | **Zero imports** |
| `buildProjectPreview` | `preview.ts` | **Zero imports** |
| `TaskWizardState` | `types.ts` | Only used by deleted wizard |
| `ProjectWizardState` | `types.ts` | Only used by deleted wizard |
| `HIERARCHY_LABELS` constant | `hierarchy-labels.ts` | **Zero usages** in components (deprecated) |
| `highlightProjectId` prop | `project-workspace.tsx` | No callers |
| `preview.ts` `WorkCreationMode` previews | `preview.ts` | Partially dead (`buildBoardPreview` still used) |

---

## 8. Manual QA Checklist (Not Run — Required Before Phase 2)

- [ ] Create task from Projects header → appears in Operations tree with correct placement
- [ ] Create task from Operations header → forecast preview matches created package
- [ ] Create task from `/projects/[id]` → defaults to that program
- [ ] Assign existing from Operations → updates assignee, no duplicate task
- [ ] SI project on Operations → labels show Manufacturer / Year
- [ ] ADAS project on Operations → labels show Workstream / Milestone
- [ ] Employee task detail → smart labels for context fields
- [ ] Click program name on portfolio → `/projects/[id]` loads
- [ ] Old bookmark `/projects?projectId=x` → redirects
- [ ] Create task on program page → page refreshes with new task (tests F-01)
- [ ] QA submit flow still works on created task
- [ ] Reports / project health still show created task in rollups

---

## 9. Phase 2 Gate Criteria

Phase 2 may begin when:

1. Manual QA checklist above is **complete** with no blockers  
2. **F-01** fixed (`revalidatePath('/projects/[id]')` or `revalidatePath('/projects', 'layout')`)  
3. **Dead code** from §7 removed or documented as intentional  
4. Team accepts **F-04** (AddWorkPackageDialog) as intentional second path OR plans to merge into Composer  

Optional before Phase 2 (recommended):

- Fix **F-03** StructurePreviewPanel labels  
- Consolidate duplicate **AddManufacturerDialog**  
- Remove orphaned **highlightProjectId**

---

*Audit complete. No code was modified during this validation pass.*

---

## 10. Post-Audit Fixes Applied (2026-06-23)

The following audit findings were addressed in code after the validation pass:

| ID | Status | Fix |
|----|--------|-----|
| F-01 | ✅ Fixed | `revalidateWorkSurfaces(projectId?)` in `lib/data/revalidate-work.ts`; wired through `crud.ts`, `project-metrics.ts`, `templates.ts` |
| F-03 | ✅ Fixed | `StructurePreview` carries `projectType` / `structureMode`; panel passes to `getHierarchyLabels()` |
| F-05 | ✅ Fixed | `project-workspace.tsx` imports shared dialogs from `operations-dialogs.tsx` (~260 lines removed) |
| F-06 | ✅ Fixed | Operations bulk delete uses `{taskPlural}` |
| F-07 | ✅ Fixed | `highlightProjectId` prop removed from `ProjectWorkspace` |
| F-08 | ✅ Fixed | Unused `projects?` removed from `AssignTaskDialog` props |
| F-10 | ✅ Fixed | Error string → "Workstream name is required" |
| §7 dead code | ✅ Fixed | Removed `project-guided-steps.ts`, unused preview/types wizard artifacts |
| Labels (low) | ✅ Fixed | Ops detail "Active tasks" / year panel "Tasks"; `AddWorkPackageDialog` uses smart labels |

| ID | Status | Notes |
|----|--------|-------|
| F-02 | ⏳ Open | Manual QA checklist (§8) still not run; no automated tests added |
| F-04 | ⏳ Accepted | `AddWorkPackageDialog` remains intentional in-tree path (merge into Composer = Phase 2) |
| F-09 | ⏳ Open | Composer `requireAssignee` / controlled `open` API unused — no consumer yet |

**Build:** `npm run build` passes after fixes.

**Phase 2 gate:** F-01, F-03, F-05, F-07, dead code — done. **Blocker remaining:** manual QA (F-02).
