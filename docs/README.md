# Flow Operations Documentation

Enterprise operations manual for **Flow** — the Protech production management platform.

**Production URL:** https://flowproduction.space  
**Last updated:** July 7, 2026 (Flow 2 — batch submissions, QA Center wings, Audit Engine, Library Intelligence, files browser)

Documentation is updated as part of every deploy — see the Documentation
section of [PRODUCTION_QA_CHECKLIST.md](./PRODUCTION_QA_CHECKLIST.md).

## Document Index

| Document | Audience | Purpose |
|----------|----------|---------|
| [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) | All roles | Master reference — 20 sections covering every module, workflow, and data flow |
| [QUICK_START.md](./QUICK_START.md) | New users | Day-one onboarding — first-day tasks by role |
| [CREATING_WORK.md](./CREATING_WORK.md) | Team leads, managers | New Program, New Work hub, boards, tasks, team-scoped creation |
| [TEAM_DASHBOARDS.md](./TEAM_DASHBOARDS.md) | Managers, admins | Custom team operating views — KPIs, scope, work creation |
| [TEAM_OPERATING_MODELS.md](./TEAM_OPERATING_MODELS.md) | Admins | Per-team labels, KPIs, tracking, and forecasting configuration |
| [ADMINISTRATOR_GUIDE.md](./ADMINISTRATOR_GUIDE.md) | Admin / Super Admin | Users, departments, settings, dashboards, operating models |
| [SENIOR_MANAGER_GUIDE.md](./SENIOR_MANAGER_GUIDE.md) | Senior Manager | Org-wide visibility, projects, reporting, innovation hub |
| [MANAGER_GUIDE.md](./MANAGER_GUIDE.md) | Manager | Team-scoped operations, QA, wrap-ups, team dashboards |
| [TEAM_LEAD_GUIDE.md](./TEAM_LEAD_GUIDE.md) | Team Lead | Branch operations, daily supervision, alert response |
| [EMPLOYEE_GUIDE.md](./EMPLOYEE_GUIDE.md) | Employee | Workspace, clock, tasks, QA submit, daily reports |
| [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) | Technical / Admin | Routes, data model, persistence, integrations |
| [FEATURE_REFERENCE.md](./FEATURE_REFERENCE.md) | All roles | Master inventory of pages, routes, permissions, alerts |
| [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | All roles | Common problems, causes, resolution steps |
| [SYSTEM_HEALTH_AUDIT.md](./SYSTEM_HEALTH_AUDIT.md) | Admin / Product | Known gaps, dead ends, recommendations |

## How to Use This Library

1. **Brand-new employee** → Start with [QUICK_START.md](./QUICK_START.md), then [EMPLOYEE_GUIDE.md](./EMPLOYEE_GUIDE.md).
2. **New manager or lead** → [QUICK_START.md](./QUICK_START.md) + [CREATING_WORK.md](./CREATING_WORK.md) + [TEAM_DASHBOARDS.md](./TEAM_DASHBOARDS.md) + role guide.
3. **Administrator** → [ADMINISTRATOR_GUIDE.md](./ADMINISTRATOR_GUIDE.md) + [TEAM_OPERATING_MODELS.md](./TEAM_OPERATING_MODELS.md) + [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md).
4. **Executive / leadership** → [OPERATIONS_MANUAL.md](./OPERATIONS_MANUAL.md) Sections 1, 3, 10, 13 + [SENIOR_MANAGER_GUIDE.md](./SENIOR_MANAGER_GUIDE.md).

All content is derived from the live codebase (`flow/src`) as of the current release — not generic placeholders.

## In-App Access

Documentation is also available inside Flow:

| URL | Description |
|-----|-------------|
| `/docs` | Documentation index with role-based recommendations |
| `/docs/quick-start` | Quick Start Guide |
| `/docs/creating-work` | Creating Projects & Tasks |
| `/docs/team-dashboards` | Team Dashboards |
| `/docs/team-operating-models` | Team Operating Models |
| `/docs/operations-manual` | Full Operations Manual |
| `/docs/employee-guide` | Employee Guide (etc.) |

**Navigation:** Sidebar → **Reporting** → **Help & Docs** (management roles). Employee header → **Help & Docs**.
