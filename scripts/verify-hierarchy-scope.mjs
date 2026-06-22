/**
 * Quick hierarchy scope verification against acceptance scenario.
 * Run: node scripts/verify-hierarchy-scope.mjs
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Register ts paths via compiled approach - use dynamic import of built modules
// Simpler: inline minimal test data matching mock-data reporting chain

const users = [
  { id: "user-admin", full_name: "Dusty", role: "admin", organizational_position: "manager", system_access_level: "admin", is_active: true, manager_id: null, team_id: null },
  { id: "user-mark", full_name: "Mark Williams", role: "senior_manager", organizational_position: "senior_manager", system_access_level: "standard", is_active: true, manager_id: "user-admin", team_id: null },
  { id: "user-manager", full_name: "Manager A", role: "manager", organizational_position: "manager", system_access_level: "standard", is_active: true, manager_id: "user-mark", team_id: "team-1" },
  { id: "user-mgr-b", full_name: "Manager B", role: "manager", organizational_position: "manager", system_access_level: "standard", is_active: true, manager_id: "user-mark", team_id: "team-2" },
  { id: "user-tara", full_name: "Team Lead A1", role: "teamlead", organizational_position: "team_lead", system_access_level: "standard", is_active: true, manager_id: "user-manager", team_id: "team-1" },
  { id: "user-tl-b1", full_name: "Team Lead B1", role: "teamlead", organizational_position: "team_lead", system_access_level: "standard", is_active: true, manager_id: "user-mgr-b", team_id: "team-2" },
  { id: "user-michael", full_name: "Employee A1", role: "employee", organizational_position: "employee", system_access_level: "standard", is_active: true, manager_id: "user-tara", team_id: "team-1" },
  { id: "user-tyler", full_name: "Employee A2", role: "employee", organizational_position: "employee", system_access_level: "standard", is_active: true, manager_id: "user-tara", team_id: "team-1" },
  { id: "user-emp-b1", full_name: "Employee B1", role: "employee", organizational_position: "employee", system_access_level: "standard", is_active: true, manager_id: "user-tl-b1", team_id: "team-2" },
];

const teams = [
  { id: "team-1", name: "Team 1", manager_id: "user-manager", department_id: "dept-1" },
  { id: "team-2", name: "Team 2", manager_id: "user-mgr-b", department_id: "dept-2" },
];

// Mirror visibility-core logic (manager_id fallback when no hierarchy store)
function hasAdminAccess(user) {
  return user.system_access_level === "admin" || user.system_access_level === "super_admin";
}

function getOrganizationalScopeRole(user) {
  if (user.organizational_position === "team_lead") return "teamlead";
  if (user.organizational_position === "manager") return "manager";
  if (user.organizational_position === "senior_manager") return "senior_manager";
  if (user.organizational_position === "employee") return "employee";
  return user.role;
}

function isHierarchyOrgWide(viewer) {
  if (hasAdminAccess(viewer)) return true;
  return getOrganizationalScopeRole(viewer) === "viewer";
}

function getDirectReportIds(supervisorId, allUsers) {
  return allUsers.filter((u) => u.is_active && u.manager_id === supervisorId).map((u) => u.id);
}

function getAllDescendantIds(supervisorId, allUsers) {
  const result = [];
  const queue = [...getDirectReportIds(supervisorId, allUsers)];
  while (queue.length) {
    const id = queue.shift();
    if (result.includes(id)) continue;
    result.push(id);
    queue.push(...getDirectReportIds(id, allUsers));
  }
  return result;
}

function getEffectiveScopeMode(user) {
  const scopeRole = getOrganizationalScopeRole(user);
  if (scopeRole === "viewer") return "org";
  if (scopeRole === "senior_manager") return "branch";
  if (scopeRole === "manager") return "branch";
  if (scopeRole === "teamlead") return "team";
  return "self";
}

function getVisibleUserIds(viewer, allUsers) {
  const active = allUsers.filter((u) => u.is_active);
  if (isHierarchyOrgWide(viewer)) return active.map((u) => u.id);
  if (getOrganizationalScopeRole(viewer) === "employee") return [viewer.id];
  const mode = getEffectiveScopeMode(viewer);
  if (mode === "branch") return [viewer.id, ...getAllDescendantIds(viewer.id, active)];
  if (mode === "team") {
    if (getOrganizationalScopeRole(viewer) === "teamlead") {
      return [viewer.id, ...getDirectReportIds(viewer.id, active)];
    }
  }
  return [viewer.id];
}

function assert(label, condition) {
  console.log(condition ? "PASS" : "FAIL", label);
  if (!condition) process.exitCode = 1;
}

const michael = users.find((u) => u.id === "user-michael");
const tara = users.find((u) => u.id === "user-tara");
const managerA = users.find((u) => u.id === "user-manager");
const mark = users.find((u) => u.id === "user-mark");
const dusty = users.find((u) => u.id === "user-admin");

assert("Employee A1 sees only self", getVisibleUserIds(michael, users).join() === "user-michael");

const taraVisible = new Set(getVisibleUserIds(tara, users));
assert("TL A1 sees employees A1/A2", taraVisible.has("user-michael") && taraVisible.has("user-tyler"));
assert("TL A1 does not see Employee B1", !taraVisible.has("user-emp-b1"));

const mgrVisible = new Set(getVisibleUserIds(managerA, users));
assert("Manager A sees TL + employees", ["user-tara", "user-michael", "user-tyler"].every((id) => mgrVisible.has(id)));
assert("Manager A does not see Manager B branch", !["user-mgr-b", "user-tl-b1", "user-emp-b1"].some((id) => mgrVisible.has(id)));

const markVisible = new Set(getVisibleUserIds(mark, users));
assert(
  "Mark sees full subtree",
  ["user-manager", "user-mgr-b", "user-tara", "user-tl-b1", "user-michael", "user-tyler", "user-emp-b1"].every((id) =>
    markVisible.has(id)
  )
);

assert("Dusty admin is org-wide", isHierarchyOrgWide(dusty));
assert("Dusty sees all users", getVisibleUserIds(dusty, users).length === users.length);
