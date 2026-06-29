# Team Dashboards

**Audience:** Administrators (configure), managers and team leads (use)  
**In-app:** `/docs/team-dashboards`  
**Admin route:** `/settings/team-dashboards`  
**Runtime route:** `/teams/[slug]` (example: `/teams/advanced-projects`)

---

## What Team Dashboards Are

A **team dashboard** is a custom operating view for a specific team or program scope. Each dashboard can show:

- **KPI cards** — active programs, health score, at-risk count, open tasks, capacity, and more
- **Portfolio intelligence** — trend and risk signals for programs in scope
- **Programs in scope** — portfolio cards with quick actions (Ops, Health, Add task)
- **Work creation** — New Program, New Work (board/task), and Operations link — scoped to the team
- **Sidebar link** — optional nav item so the team can open their dashboard directly

Team dashboards are **built in the UI** — no code deploy required.

---

## Who Can Configure Dashboards

| Role | Access |
|------|--------|
| Admin / Super Admin | Full create, edit, delete at `/settings/team-dashboards` |
| Others | View dashboards they are allowed to access |

---

## Creating a Team Dashboard

1. Go to **Settings → Team dashboards** (`/settings/team-dashboards`).
2. Click **New dashboard**.
3. Configure:

| Section | What to set |
|---------|-------------|
| **Basics** | Label, slug (URL), description, eyebrow text |
| **Team scope** | Link to a team by name or ID; include projects assigned to that team |
| **Project scope** | Filter by `project_type` (e.g. `adas`, `research`) and/or explicit project IDs |
| **KPIs** | Select from the KPI catalog (active programs, health, at-risk, open tasks, etc.) |
| **Portfolio** | Toggle whether to show the program portfolio section |
| **Navigation** | Sidebar label and group (Operations or Reporting) |
| **Access** | Roles, team members, and team leads who can view |

4. **Save** — the dashboard is available at `/teams/{slug}` and appears in the sidebar for users with access.

---

## Using a Team Dashboard (Managers & Leads)

When you open a team dashboard:

1. **Scan KPIs** at the top for today's posture.
2. **Review programs in scope** — click a card for detail, Ops, or Health.
3. **Create work** from the header:
   - **New Program** — launches the program builder with team department/team pre-filled
   - **New Work** — board or task creation scoped to team programs
   - **Operations** — jump to the ops board
4. Use **Add task** on individual program cards when you need a quick assignment.

The dashboard respects the team's **operating model** for labels, KPIs, and creation defaults when one is assigned.

---

## Advanced Projects Example

The seeded **Advanced Projects** dashboard (`/teams/advanced-projects`) scopes to:

- Team: Advanced Projects Team
- Project types: `adas`, `research`, `custom`
- KPIs: health, at-risk, open tasks, capacity

Admins can edit this pack or clone the pattern for other teams.

---

## Relationship to Operating Models

| Layer | Purpose |
|-------|---------|
| **Operating model** | How the team works — labels, tracking fields, KPI definitions, forecast rules |
| **Team dashboard** | What the team sees — scoped programs, selected KPIs, nav link, access |

Configure operating models at **Settings → Operating models**. See [Team Operating Models](./TEAM_OPERATING_MODELS.md).

---

## Troubleshooting

| Issue | Check |
|-------|--------|
| Dashboard not in sidebar | Pack `is_active`, nav configured, user role in access list |
| No programs in scope | Team assignment on projects; project types in pack config |
| Can't configure | Admin role required for `/settings/team-dashboards` |
| KPIs show zero | Programs may be outside scope; verify filters |

---

## Related Docs

- [Team Operating Models](./TEAM_OPERATING_MODELS.md)
- [Creating Projects & Tasks](./CREATING_WORK.md)
- [Administrator Guide](./ADMINISTRATOR_GUIDE.md)
- [Manager Guide](./MANAGER_GUIDE.md)
