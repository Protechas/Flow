# Team Operating Models

**Audience:** Administrators (configure), all roles (experience shaped by model)  
**In-app:** `/docs/team-operating-models`  
**Admin route:** `/settings/operating-models`

---

## What Operating Models Are

A **team operating model** defines how a department or team works inside Flow — without forcing every team into the same Manufacturer/Year/Task pattern.

Each model configures:

| Area | Examples |
|------|----------|
| **Work structure labels** | Manufacturer/Year, Workstream/Milestone, Dataset/Batch, Training Module/Phase |
| **Project types** | SI Corrections, ADAS, ID³ Validation, Training, Board |
| **Task types** | Document, feature, bug, validation, certification |
| **Tracking fields** | Documents, records, files, QA, corrections, accuracy, features, bugs |
| **KPIs** | Team-specific metrics shown on dashboards and reports |
| **Forecasting rules** | Default minutes per unit, productive hours, capacity threshold |
| **Task defaults** | QA required, files required, which placement pickers to show |

**Users never see this configuration screen** — they see a simplified experience shaped by the model.

---

## Seeded Models (Fallback-Safe)

Flow ships with presets. Existing projects are **not broken** — they inherit a model from `project_type` and team assignment. If nothing matches, **General Operations** is used.

| Model | Labels | Typical team |
|-------|--------|--------------|
| **General Operations** | Work Package / Phase / Task | Fallback for all |
| **Service Information** | Manufacturer / Year / Task | SI, Special Functions |
| **Advanced Projects** | Workstream / Milestone / Task | ADAS, research programs |
| **ID³ Validation** | Dataset / Validation Batch / Task | Validation teams |
| **Training** | Training Module / Phase / Task | Training teams |

---

## Creating or Editing a Model (8-Step Wizard)

1. Go to **Settings → Operating models** (`/settings/operating-models`).
2. Click **New model** or edit an existing preset.
3. Walk through the wizard:

| Step | Configure |
|------|-----------|
| 1. Team / Department | Name, slug, optional team or department assignment |
| 2. Work structure | Structure mode + custom labels for package, phase, task |
| 3. Project types | Which program types this team uses; default type |
| 4. Task types | Categories (feature, document, validation, etc.) |
| 5. Tracking fields | What this team must track on work |
| 6. KPIs | Select from catalog (documents completed, accuracy %, features delivered, etc.) |
| 7. Forecasting | Minutes per unit, productive hours, QA/files defaults, placement pickers |
| 8. Review & save | Confirm and persist |

**General Operations** cannot be deleted — it is the system fallback.

---

## How Models Apply at Runtime

### Project creation

When you pick a **department** and **team** in the **New Program** builder:

- Labels match the team's model
- Default project type and structure mode are pre-filled
- Forecast and QA defaults follow the model

### Task creation

When creating a task for a team-scoped program:

- Irrelevant fields are hidden (e.g. Advanced Projects won't force Manufacturer/Year)
- Document vs record estimate labels adapt to tracking fields
- QA and file requirements use model defaults

### Dashboards

Team dashboards show KPIs from the resolved operating model, with team-specific forecast rules merged into intelligence calculations.

### Existing projects

Projects without an explicit model assignment resolve by:

1. Team on the project → team's operating model
2. Department → department-level model
3. `project_type` → preset mapping (e.g. `si_corrections` → Service Information)
4. Fallback → General Operations

---

## KPI Types

| Type | Description |
|------|-------------|
| Count | Integer metrics (open tasks, documents completed) |
| Percentage | Completion %, accuracy %, QA pass rate |
| Hours | Time-based metrics |
| Manual | Entered on projects or reports (shows placeholder until tracked) |
| Formula / Portfolio | Pulled from portfolio intelligence when mapped |

Manual KPIs display **—** on dashboards until values are tracked at the project level via custom metrics or future manual entry UI.

---

## Permissions

| Role | Capability |
|------|------------|
| Admin / Super Admin | Create, edit, delete models (except General Operations) |
| Senior Manager | View models for their department (read via settings if granted) |
| Manager / Team Lead | Experience shaped by model; no config access |
| Employee | Sees only fields relevant to assigned work |

---

## Best Practices

1. **One model per team** when workflows differ materially — assign via team ID on the model.
2. **Use department-level models** when all teams in a dept share the same structure.
3. **Pair with a team dashboard** — operating model sets KPIs/labels; dashboard sets scope and nav.
4. **Don't duplicate Manufacturer/Year** for teams that use workstreams — labels drive UI only; backend structure is unchanged.

---

## Related Docs

- [Team Dashboards](./TEAM_DASHBOARDS.md)
- [Creating Projects & Tasks](./CREATING_WORK.md)
- [Administrator Guide](./ADMINISTRATOR_GUIDE.md)
- [Feature Reference](./FEATURE_REFERENCE.md)
