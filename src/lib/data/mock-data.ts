import {
  deriveOrganizationalPositionFromRole,
  deriveSystemAccessLevelFromRole,
} from "@/lib/auth/access-level";
import type {
  ActivityEvent,
  Correction,
  DailyWrapUp,
  Department,
  DepartmentUser,
  FlowFile,
  ForecastSettings,
  Manufacturer,
  Project,
  QaReview,
  Team,
  TimeLog,
  User,
  WorkPackage,
  WorkPriority,
  WorkStatus,
} from "@/types/flow";
import { addDays, format, subDays } from "date-fns";

const now = new Date();
const today = format(now, "yyyy-MM-dd");
const yesterday = format(subDays(now, 1), "yyyy-MM-dd");
const nextWeek = format(addDays(now, 7), "yyyy-MM-dd");

export const DEFAULT_DEPARTMENT_ID = "dept-service-info";
export const DEPT_ADAS_ID = "dept-adas";

export const MOCK_DEPARTMENTS: Department[] = [
  {
    id: DEFAULT_DEPARTMENT_ID,
    name: "Service Info",
    description: "Vehicle service information research, corrections, and documentation",
    lead_user_id: "user-manager",
    status: "active",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
  {
    id: DEPT_ADAS_ID,
    name: "ADAS Research",
    description: "Advanced driver assistance systems documentation and validation",
    lead_user_id: "user-manager",
    status: "active",
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  },
];

export const MOCK_TEAM: Team = {
  id: "team-1",
  name: "Manager A Branch",
  description: "Manager A operations team",
  department_id: DEFAULT_DEPARTMENT_ID,
  manager_id: "user-manager",
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

export const MOCK_TEAM_B: Team = {
  id: "team-b",
  name: "Manager B Branch",
  description: "Manager B operations team",
  department_id: DEFAULT_DEPARTMENT_ID,
  manager_id: "user-mgr-b",
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

export const MOCK_TEAM_C: Team = {
  id: "team-c",
  name: "Manager C Branch",
  description: "Manager C operations team",
  department_id: DEFAULT_DEPARTMENT_ID,
  manager_id: "user-mgr-c",
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

export const MOCK_TEAM_ADAS: Team = {
  id: "team-2",
  name: "ADAS Documentation Team",
  description: "ADAS feature documentation specialists",
  department_id: DEPT_ADAS_ID,
  manager_id: "user-mgr-b",
  created_at: now.toISOString(),
  updated_at: now.toISOString(),
};

export const MOCK_TEAMS: Team[] = [MOCK_TEAM, MOCK_TEAM_B, MOCK_TEAM_C, MOCK_TEAM_ADAS];

function mockUser(
  id: string,
  first: string,
  last: string,
  email: string,
  role: User["role"],
  extra?: Partial<User>
): User {
  const full = [first, last].filter(Boolean).join(" ");
  const pay_type =
    extra?.pay_type ??
    (role === "employee" ? ("hourly" as const) : ("salary" as const));
  return {
    id,
    email,
    first_name: first,
    last_name: last,
    full_name: full,
    role,
    organizational_position: deriveOrganizationalPositionFromRole(role),
    system_access_level: deriveSystemAccessLevelFromRole(role),
    pay_type,
    team_id: "team-1",
    manager_id: role === "employee" ? "user-manager" : null,
    avatar_url: null,
    hire_date: "2024-06-01",
    last_login_at: null,
    is_active: true,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
    ...extra,
  };
}

export const MOCK_USERS: User[] = [
  mockUser("user-admin", "Dusty", "", "dusty@flow.local", "admin", {
    organizational_position: "manager",
    system_access_level: "admin",
  }),
  mockUser("user-mark", "Mark", "Williams", "mark@flow.local", "senior_manager", {
    manager_id: "user-admin",
    team_id: null,
  }),
  mockUser("user-manager", "Manager", "A", "manager-a@flow.local", "manager", {
    manager_id: "user-mark",
    team_id: "team-1",
  }),
  mockUser("user-mgr-b", "Manager", "B", "manager-b@flow.local", "manager", {
    manager_id: "user-mark",
    team_id: "team-b",
  }),
  mockUser("user-mgr-c", "Manager", "C", "manager-c@flow.local", "manager", {
    manager_id: "user-mark",
    team_id: "team-c",
  }),
  mockUser("user-tara", "Team Lead", "A1", "tl-a1@flow.local", "teamlead", {
    manager_id: "user-manager",
    team_id: "team-1",
  }),
  mockUser("user-tl-a2", "Team Lead", "A2", "tl-a2@flow.local", "teamlead", {
    manager_id: "user-manager",
    team_id: "team-1",
  }),
  mockUser("user-tl-b1", "Team Lead", "B1", "tl-b1@flow.local", "teamlead", {
    manager_id: "user-mgr-b",
    team_id: "team-b",
  }),
  mockUser("user-tl-b2", "Team Lead", "B2", "tl-b2@flow.local", "teamlead", {
    manager_id: "user-mgr-b",
    team_id: "team-b",
  }),
  mockUser("user-tl-c1", "Team Lead", "C1", "tl-c1@flow.local", "teamlead", {
    manager_id: "user-mgr-c",
    team_id: "team-c",
  }),
  mockUser("user-tl-c2", "Team Lead", "C2", "tl-c2@flow.local", "teamlead", {
    manager_id: "user-mgr-c",
    team_id: "team-c",
  }),
  mockUser("user-viewer", "Sam", "Viewer", "viewer@flow.local", "viewer", {
    manager_id: "user-mark",
  }),
  mockUser("user-michael", "Employee", "A1", "emp-a1@flow.local", "employee", {
    manager_id: "user-tara",
    team_id: "team-1",
  }),
  mockUser("user-tyler", "Employee", "A2", "emp-a2@flow.local", "employee", {
    manager_id: "user-tara",
    team_id: "team-1",
    pay_type: "salary",
  }),
  mockUser("user-desi", "Employee", "A3", "emp-a3@flow.local", "employee", {
    manager_id: "user-tara",
    team_id: "team-1",
  }),
  mockUser("user-emp-b1", "Employee", "B1", "emp-b1@flow.local", "employee", {
    manager_id: "user-tl-b1",
    team_id: "team-b",
  }),
  mockUser("user-emp-b2", "Employee", "B2", "emp-b2@flow.local", "employee", {
    manager_id: "user-tl-b1",
    team_id: "team-b",
  }),
  mockUser("user-emp-c1", "Employee", "C1", "emp-c1@flow.local", "employee", {
    manager_id: "user-tl-c1",
    team_id: "team-c",
  }),
  mockUser("user-emp-c2", "Employee", "C2", "emp-c2@flow.local", "employee", {
    manager_id: "user-tl-c1",
    team_id: "team-c",
  }),
  mockUser("user-jacob", "Jacob", "", "jacob@flow.local", "employee", {
    manager_id: "user-tl-a2",
    team_id: "team-1",
  }),
  mockUser("user-rai", "Rai", "", "rai@flow.local", "employee", {
    manager_id: "user-tl-b2",
    team_id: "team-2",
  }),
];

function deptUser(
  userId: string,
  departmentId: string,
  isPrimary: boolean,
  role: DepartmentUser["role_in_department"] = "member"
): DepartmentUser {
  return {
    id: `du-${userId}-${departmentId}`,
    department_id: departmentId,
    user_id: userId,
    role_in_department: role,
    is_primary: isPrimary,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export const MOCK_DEPARTMENT_USERS: DepartmentUser[] = [
  ...MOCK_USERS.map((u) =>
    deptUser(
      u.id,
      u.team_id === "team-2" ? DEPT_ADAS_ID : DEFAULT_DEPARTMENT_ID,
      true,
      u.role === "teamlead" ? "lead" : u.role === "manager" ? "manager" : "member"
    )
  ),
  deptUser("user-manager", DEPT_ADAS_ID, false, "manager"),
  deptUser("user-tara", DEPT_ADAS_ID, false, "lead"),
];

export const MOCK_PROJECTS: Project[] = [
  { id: "proj-sf", name: "SF Phase 1 2026", description: "Service Info phase 1 deliverables for 2026 model year", project_type: "special_functions", department_id: DEFAULT_DEPARTMENT_ID, team_id: "team-1", status: "active", priority: "high", start_date: "2026-01-01", due_date: "2026-12-31", project_owner_id: "user-manager", created_by: "user-manager", created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: "proj-adas", name: "ADAS 2026", description: "ADAS feature documentation and validation", project_type: "adas", department_id: DEPT_ADAS_ID, team_id: "team-2", status: "active", priority: "medium", start_date: "2026-02-01", due_date: null, project_owner_id: "user-manager", created_by: "user-manager", created_at: now.toISOString(), updated_at: now.toISOString() },
  { id: "proj-si", name: "SI Corrections", description: "Correction backlog from QA returns", project_type: "si_corrections", department_id: DEFAULT_DEPARTMENT_ID, team_id: "team-1", status: "active", priority: "urgent", start_date: "2025-11-01", due_date: null, project_owner_id: "user-manager", created_by: "user-manager", created_at: now.toISOString(), updated_at: now.toISOString() },
];

const MFR_NAMES = ["Toyota", "Honda", "Ford", "Nissan", "Mercedes", "BMW"] as const;
const ANALYSTS = [
  "user-michael",
  "user-tyler",
  "user-rai",
  "user-desi",
  "user-jacob",
  "user-emp-b1",
  "user-emp-b2",
  "user-emp-c1",
  "user-emp-c2",
] as const;

function mfrId(projectId: string, name: string) {
  return `mfr-${projectId}-${name.toLowerCase()}`;
}

export const MOCK_MANUFACTURERS: Manufacturer[] = MOCK_PROJECTS.flatMap((p) =>
  MFR_NAMES.map((name) => ({
    id: mfrId(p.id, name),
    project_id: p.id,
    name,
    code: name.slice(0, 3).toUpperCase(),
    assigned_to: null,
    status: "not_started" as WorkStatus,
    priority: "medium" as WorkPriority,
    due_date: null,
    notes: null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  }))
);

type PkgSeed = {
  projectId: string;
  mfr: (typeof MFR_NAMES)[number];
  year: number;
  title: string;
  status: WorkStatus;
  priority?: WorkPriority;
  assigned?: (typeof ANALYSTS)[number];
  due?: string;
  hours?: number;
  est?: number;
  files?: number;
  corrections?: number;
  qa?: WorkPackage["qa_status"];
  completed?: string;
  docs?: number;
  complexity?: WorkPackage["complexity_level"];
};

const SEEDS: PkgSeed[] = [
  // SF Phase 1 2026
  { projectId: "proj-sf", mfr: "Toyota", year: 2026, title: "TYT 2026 SF Build", status: "working_on_it", assigned: "user-michael", due: nextWeek, hours: 6, est: 10, files: 2, docs: 180, complexity: "standard" },
  { projectId: "proj-sf", mfr: "Toyota", year: 2025, title: "TYT 2025 SF Final", status: "done", assigned: "user-michael", due: yesterday, hours: 9, est: 9, files: 4, qa: "passed", completed: today },
  { projectId: "proj-sf", mfr: "Toyota", year: 2024, title: "TYT 2024 Archive", status: "done", assigned: "user-rai", hours: 8, est: 8, files: 3, qa: "passed", completed: yesterday },
  { projectId: "proj-sf", mfr: "Honda", year: 2026, title: "HND 2026 SF Package", status: "ready_for_qa", assigned: "user-rai", due: today, hours: 11, est: 12, files: 5 },
  { projectId: "proj-sf", mfr: "Honda", year: 2025, title: "HND 2025 Review", status: "in_qa", assigned: "user-rai", due: today, hours: 7, est: 8, files: 2 },
  { projectId: "proj-sf", mfr: "Ford", year: 2026, title: "FRD 2026 SF Line", status: "assigned", assigned: "user-tyler", due: nextWeek, est: 14, docs: 90, complexity: "standard" },
  { projectId: "proj-sf", mfr: "Ford", year: 2024, title: "FRD 2024 Closeout", status: "done", assigned: "user-tyler", hours: 10, est: 10, files: 6, qa: "passed", completed: yesterday },
  { projectId: "proj-sf", mfr: "Nissan", year: 2026, title: "NSN 2026 SF", status: "waiting", assigned: "user-rai", due: nextWeek, est: 9 },
  { projectId: "proj-sf", mfr: "Mercedes", year: 2026, title: "MBZ 2026 SF", status: "stuck", assigned: "user-desi", due: yesterday, hours: 3, est: 12, files: 1, docs: 120, complexity: "complex" },
  { projectId: "proj-sf", mfr: "BMW", year: 2025, title: "BMW 2025 SF", status: "correction_needed", assigned: "user-jacob", due: today, hours: 9, est: 10, corrections: 2, qa: "minor_correction", files: 3 },
  { projectId: "proj-sf", mfr: "BMW", year: 2023, title: "BMW 2023 Legacy", status: "done", assigned: "user-jacob", hours: 6, est: 6, qa: "passed", completed: yesterday },
  // ADAS 2026
  { projectId: "proj-adas", mfr: "Toyota", year: 2026, title: "TYT ADAS 2026 Matrix", status: "working_on_it", assigned: "user-rai", due: today, hours: 5, est: 16, files: 1, docs: 200, complexity: "very_complex" },
  { projectId: "proj-adas", mfr: "Honda", year: 2026, title: "HND ADAS Sensors", status: "assigned", assigned: "user-desi", due: nextWeek, est: 12 },
  { projectId: "proj-adas", mfr: "Ford", year: 2026, title: "FRD ADAS Package", status: "not_started", est: 10 },
  { projectId: "proj-adas", mfr: "Mercedes", year: 2026, title: "MBZ ADAS L2+", status: "working_on_it", assigned: "user-michael", due: nextWeek, hours: 4, est: 14 },
  { projectId: "proj-adas", mfr: "BMW", year: 2026, title: "BMW ADAS 2026", status: "ready_for_qa", assigned: "user-rai", due: today, hours: 13, est: 14, files: 4 },
  { projectId: "proj-adas", mfr: "Nissan", year: 2025, title: "NSN ADAS 2025", status: "done", assigned: "user-tyler", hours: 11, est: 11, qa: "passed", completed: today, files: 2 },
  // SI Corrections
  { projectId: "proj-si", mfr: "Toyota", year: 2024, title: "TYT SI Format Fix", status: "correction_needed", assigned: "user-michael", due: today, hours: 2, est: 4, corrections: 1, qa: "minor_correction" },
  { projectId: "proj-si", mfr: "Honda", year: 2023, title: "HND SI Data Gap", status: "working_on_it", assigned: "user-rai", due: yesterday, hours: 3, est: 5, files: 1 },
  { projectId: "proj-si", mfr: "Ford", year: 2022, title: "FRD SI Compliance", status: "stuck", assigned: "user-tyler", due: yesterday, hours: 1, est: 6 },
  { projectId: "proj-si", mfr: "Nissan", year: 2021, title: "NSN SI Table Fix", status: "assigned", assigned: "user-rai", due: nextWeek, est: 3 },
  { projectId: "proj-si", mfr: "Mercedes", year: 2020, title: "MBZ SI Legacy", status: "done", assigned: "user-desi", hours: 4, est: 4, qa: "passed", completed: today },
  { projectId: "proj-si", mfr: "BMW", year: 2019, title: "BMW SI Archive", status: "done", assigned: "user-jacob", hours: 3, est: 3, qa: "passed", completed: yesterday },
];

let pkgCounter = 0;
function buildPackage(seed: PkgSeed): WorkPackage {
  pkgCounter += 1;
  const id = `wp-${pkgCounter}`;
  const project = MOCK_PROJECTS.find((p) => p.id === seed.projectId);
  return {
    id,
    project_id: seed.projectId,
    manufacturer_id: mfrId(seed.projectId, seed.mfr),
    year_work_item_id: `yr-${mfrId(seed.projectId, seed.mfr)}-${seed.year}`,
    year: seed.year,
    department_id: project?.department_id ?? DEFAULT_DEPARTMENT_ID,
    title: seed.title,
    notes: null,
    description: null,
    assigned_to: seed.assigned ?? null,
    status: seed.status,
    priority: seed.priority ?? (seed.due === yesterday ? "urgent" : "medium"),
    due_date: seed.due ?? null,
    start_date: seed.status !== "not_started" ? format(subDays(now, 5), "yyyy-MM-dd") : null,
    completed_date: seed.completed ?? null,
    estimated_hours: seed.est ?? 8,
    actual_hours: seed.hours ?? 0,
    file_count: seed.files ?? 0,
    qa_status: seed.qa ?? "pending",
    correction_count: seed.corrections ?? 0,
    estimated_document_count: seed.docs ?? null,
    complexity_level: seed.complexity ?? null,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export const MOCK_WORK_PACKAGES: WorkPackage[] = SEEDS.map(buildPackage);

export const MOCK_TIME_LOGS: TimeLog[] = MOCK_WORK_PACKAGES.filter((p) => p.actual_hours > 0).flatMap((p, i) => [
  {
    id: `tl-${i}-1`,
    work_package_id: p.id,
    user_id: p.assigned_to!,
    hours: Math.round(p.actual_hours * 0.6 * 10) / 10,
    log_date: yesterday,
    created_at: now.toISOString(),
  },
  {
    id: `tl-${i}-2`,
    work_package_id: p.id,
    user_id: p.assigned_to!,
    hours: Math.round(p.actual_hours * 0.4 * 10) / 10,
    log_date: today,
    created_at: now.toISOString(),
  },
]).filter((t) => t.user_id);

export const MOCK_QA_REVIEWS: QaReview[] = [
  { id: "qa-1", work_package_id: MOCK_WORK_PACKAGES.find((p) => p.title.includes("2025 SF Final"))!.id, reviewer_id: "user-tara", analyst_id: "user-michael", result: "pass", reviewed_at: now.toISOString(), created_at: now.toISOString() },
  { id: "qa-2", work_package_id: MOCK_WORK_PACKAGES.find((p) => p.title.includes("BMW 2025 SF"))!.id, reviewer_id: "user-tara", analyst_id: "user-jacob", result: "minor_correction", error_category: "Formatting", notes: "Section 3 table alignment", reviewed_at: yesterday, created_at: yesterday },
  { id: "qa-3", work_package_id: MOCK_WORK_PACKAGES.find((p) => p.title.includes("NSN ADAS 2025"))!.id, reviewer_id: "user-tara", analyst_id: "user-tyler", result: "pass", reviewed_at: now.toISOString(), created_at: now.toISOString() },
  { id: "qa-4", work_package_id: MOCK_WORK_PACKAGES.find((p) => p.title.includes("TYT SI Format"))!.id, reviewer_id: "user-tara", analyst_id: "user-michael", result: "minor_correction", error_category: "Data accuracy", notes: "Missing torque spec row", reviewed_at: yesterday, created_at: yesterday },
];

export const MOCK_FILES: FlowFile[] = MOCK_WORK_PACKAGES.filter((p) => p.file_count > 0).flatMap((p, i) =>
  Array.from({ length: p.file_count }, (_, j) => ({
    id: `file-${i}-${j}`,
    work_package_id: p.id,
    uploaded_by: p.assigned_to ?? "user-manager",
    file_name: `${p.title.replace(/\s/g, "_")}_v${j + 1}.xlsx`,
    file_path: `/uploads/${p.id}/${j}`,
    file_size: 1024 * 256,
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    created_at: now.toISOString(),
  }))
);

const ANALYST_IDS = ["user-michael", "user-tyler", "user-rai", "user-desi", "user-jacob"] as const;

function daysAgo(n: number) {
  return format(subDays(now, n), "yyyy-MM-dd'T'12:00:00.000'Z'");
}

export const MOCK_ACTIVITY: ActivityEvent[] = [
  ...ANALYST_IDS.flatMap((uid, i) => {
    const pkg = MOCK_WORK_PACKAGES[i % MOCK_WORK_PACKAGES.length];
    return [
      { id: `act-${uid}-start`, user_id: uid, work_package_id: pkg?.id, type: "status_change" as const, summary: `Started work — ${pkg?.title}`, created_at: daysAgo(0) },
      { id: `act-${uid}-time`, user_id: uid, work_package_id: pkg?.id, type: "time_log" as const, summary: `Logged ${3 + (i % 3)}h`, created_at: daysAgo(1) },
      { id: `act-${uid}-file`, user_id: uid, work_package_id: pkg?.id, type: "file_upload" as const, summary: `Uploaded deliverable.xlsx`, created_at: daysAgo(2) },
      { id: `act-${uid}-qa`, user_id: uid, work_package_id: pkg?.id, type: "submit_qa" as const, summary: `Submitted to QA — ${pkg?.title}`, created_at: daysAgo(3) },
      { id: `act-${uid}-done`, user_id: uid, work_package_id: pkg?.id, type: "task_complete" as const, summary: `Completed — ${pkg?.title}`, created_at: daysAgo(5 + (i % 4)) },
      { id: `act-${uid}-cmt`, user_id: uid, work_package_id: pkg?.id, type: "comment" as const, summary: "Progress update for manager", created_at: daysAgo(4) },
    ];
  }),
  { id: "act-qa-1", user_id: "user-tara", type: "qa_review", summary: "QA pass on package", created_at: daysAgo(1) },
  { id: "act-qa-2", user_id: "user-tara", type: "qa_review", summary: "QA minor_correction on package", created_at: daysAgo(3) },
];

export const DEMO_USER_ID = "user-admin";

export const MOCK_DAILY_WRAP_UPS: DailyWrapUp[] = [
  {
    id: "wrap-michael-today",
    user_id: "user-michael",
    department_id: DEFAULT_DEPARTMENT_ID,
    wrap_date: today,
    completed_summary: "Finished TYT 2026 SF build sections 2–4. Submitted 2 files for QA.",
    blockers: "Waiting on torque spec confirmation from engineering.",
    needs_support: false,
    needs_support_note: null,
    created_at: format(now, "yyyy-MM-dd'T'17:30:00.000'Z'"),
    reviewed_at: null,
    reviewed_by: null,
    internal_notes: null,
    follow_up_needed: false,
    follow_up_notes: null,
  },
  {
    id: "wrap-desi-today",
    user_id: "user-desi",
    department_id: DEFAULT_DEPARTMENT_ID,
    wrap_date: today,
    completed_summary: "Worked MBZ 2026 SF stuck item — identified missing data source.",
    blockers: "Legacy data feed offline since Friday.",
    needs_support: true,
    needs_support_note: "Need manager to escalate with data team.",
    created_at: format(now, "yyyy-MM-dd'T'17:45:00.000'Z'"),
    reviewed_at: null,
    reviewed_by: null,
    internal_notes: null,
    follow_up_needed: true,
    follow_up_notes: null,
  },
  {
    id: "wrap-tyler-today",
    user_id: "user-tyler",
    department_id: DEFAULT_DEPARTMENT_ID,
    wrap_date: today,
    completed_summary: "Completed FRD 2024 closeout documentation. Started FRD 2026 line research.",
    blockers: null,
    needs_support: false,
    needs_support_note: null,
    created_at: format(now, "yyyy-MM-dd'T'16:55:00.000'Z'"),
    reviewed_at: format(now, "yyyy-MM-dd'T'18:10:00.000'Z'"),
    reviewed_by: "user-tara",
    internal_notes: "Good progress on closeout. No action needed.",
    follow_up_needed: false,
    follow_up_notes: null,
  },
  {
    id: "wrap-michael-yesterday",
    user_id: "user-michael",
    department_id: DEFAULT_DEPARTMENT_ID,
    wrap_date: yesterday,
    completed_summary: "Completed TYT 2025 SF Final package.",
    blockers: null,
    needs_support: false,
    needs_support_note: null,
    created_at: format(subDays(now, 1), "yyyy-MM-dd'T'17:20:00.000'Z'"),
    reviewed_at: format(subDays(now, 1), "yyyy-MM-dd'T'18:00:00.000'Z'"),
    reviewed_by: "user-tara",
    internal_notes: "Reviewed — excellent throughput.",
    follow_up_needed: false,
    follow_up_notes: null,
  },
];

export const MOCK_FORECAST_SETTINGS: ForecastSettings = {
  id: "forecast-settings-1",
  minutes_per_document: 7,
  productive_hours_per_day: 6.5,
  working_days: [1, 2, 3, 4, 5],
  updated_at: now.toISOString(),
  updated_by: "user-admin",
};
