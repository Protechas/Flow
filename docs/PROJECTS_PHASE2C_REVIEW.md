# Projects Phase 2C — Tracking Flags & Enterprise Templates

**Date:** June 2026  
**Scope:** Typed QA/file columns + enterprise templates in Program Builder

---

## 1. Summary

Phase 2C replaces notes-only QA/file tracking with typed columns and surfaces enterprise templates in the Program Builder.

---

## 2. Typed tracking flags

| Item | Detail |
|------|--------|
| **Migration** | `032_work_package_tracking_flags.sql` |
| **Columns** | `work_items.qa_required` (default true), `work_items.files_required` (default false) |
| **Types** | `WorkPackage.qa_required`, `WorkPackage.files_required` |
| **Persistence** | `work-items-db`, `flow-store`, all creation paths |
| **UI** | `TrackingFlagsBadges` on ops task detail + task-first rows |
| **Legacy** | `resolveWorkPackageTrackingFlags()` falls back to notes prose |

Creation paths updated: Program Builder, bulk matrix, quick task composer, enterprise template generator, project structure action.

---

## 3. Enterprise templates in Program Builder

| Item | Detail |
|------|--------|
| **Step 1** | Enterprise template cards below program blueprints |
| **Module** | `enterprise-template-draft.ts` |
| **Behavior** | Pre-fills structure draft: tasks, QA/files, workflow name, estimates |
| **Create** | Uses `enterpriseTemplateId` + `taskSetupMode: template` |

Templates sourced from `listEnterpriseTemplates()` (same registry as `/operations/templates`).

---

## 4. Verification

- [x] Migration SQL added
- [x] Build passes
- [ ] Migration `032` applied on Supabase
- [ ] Manual: create task with QA/files toggles → badges on Operations
- [ ] Manual: pick enterprise template in New Program → tasks match template

---

## 5. Still open

- **Project Intelligence** (portfolio scoring, capacity overlays)
- **Manual QA** (Phase 2A checklist)
