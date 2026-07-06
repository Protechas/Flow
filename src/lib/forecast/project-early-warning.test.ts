import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  buildProjectEarlyWarning,
  buildProjectEarlyWarnings,
} from "@/lib/forecast/project-early-warning";
import { DEFAULT_FORECAST_SETTINGS } from "@/lib/forecast/engine";
import type { ForecastSettings, Project, User, WorkPackage } from "@/types/flow";

const NOW = new Date("2025-06-23T15:00:00.000Z");

function makeSettings(): ForecastSettings {
  return {
    id: "fs-1",
    updated_at: NOW.toISOString(),
    updated_by: null,
    ...DEFAULT_FORECAST_SETTINGS,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Atlas Program",
    description: "Test project",
    status: "active",
    due_date: "2025-07-01",
    manual_project_due_date: "2025-07-01",
    suggested_project_due_date: "2025-07-08",
    planning_project_due_date: "2025-07-08",
    active_project_due_date: null,
    project_due_date_status: "behind_capacity",
    forecast_confidence: 80,
    estimated_total_documents: 100,
    complexity_level: "standard",
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

function makeTask(overrides: Partial<WorkPackage> = {}): WorkPackage {
  return {
    id: "task-1",
    project_id: "proj-1",
    manufacturer_id: "mfg-1",
    year_work_item_id: "ywi-1",
    year: 2025,
    title: "Build charts",
    assigned_to: "user-a",
    status: "working_on_it",
    priority: "medium",
    estimated_hours: 8,
    actual_hours: 0,
    estimated_document_count: 20,
    current_documents_completed: 5,
    complexity_level: "standard",
    file_count: 5,
    qa_status: "pending",
    correction_count: 0,
    forecast_mode: "planning",
    due_date_status: "at_risk",
    suggested_due_date: "2025-07-08",
    planning_due_date: "2025-07-08",
    assigned_at: NOW.toISOString(),
    created_at: NOW.toISOString(),
    updated_at: NOW.toISOString(),
    ...overrides,
  };
}

const users: User[] = [
  {
    id: "user-a",
    email: "a@test.com",
    full_name: "Analyst A",
    role: "employee",
    team_id: "team-1",
    created_at: NOW.toISOString(),
  },
  {
    id: "user-b",
    email: "b@test.com",
    full_name: "Analyst B",
    role: "employee",
    team_id: "team-1",
    created_at: NOW.toISOString(),
  },
];

describe("project early warning", () => {
  const prevTz = process.env.NEXT_PUBLIC_FLOW_TIMEZONE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_FLOW_TIMEZONE = "America/Chicago";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_FLOW_TIMEZONE = prevTz;
  });

  it("reports days late when forecast lands after the target date", () => {
    const warning = buildProjectEarlyWarning(
      makeProject(),
      [makeTask()],
      users,
      makeSettings(),
      [],
      users,
      NOW
    );

    expect(warning.daysLate).toBeGreaterThan(0);
    expect(warning.headline).toMatch(/Lands \d+ business days late/);
    expect(warning.severity).toBe("critical");
    expect(warning.reasons.some((r) => r.includes("Forecast completion"))).toBe(true);
  });

  it("returns on_track when forecast meets the target", () => {
    const warning = buildProjectEarlyWarning(
      makeProject({
        due_date: "2025-07-15",
        manual_project_due_date: "2025-07-15",
        suggested_project_due_date: "2025-07-10",
        planning_project_due_date: "2025-07-10",
        project_due_date_status: "on_track",
      }),
      [makeTask({ due_date_status: "on_track", suggested_due_date: "2025-07-10" })],
      users,
      makeSettings(),
      [],
      users,
      NOW
    );

    expect(warning.severity).toBe("on_track");
    expect(warning.daysLate).toBe(0);
    expect(warning.headline).toBe("On track for target date");
  });

  it("filters buildProjectEarlyWarnings to at-risk projects only", () => {
    const warnings = buildProjectEarlyWarnings({
      projects: [
        makeProject(),
        makeProject({
          id: "proj-2",
          name: "Healthy",
          due_date: "2025-08-01",
          manual_project_due_date: "2025-08-01",
          suggested_project_due_date: "2025-07-20",
          planning_project_due_date: "2025-07-20",
          project_due_date_status: "on_track",
        }),
      ],
      packages: [
        makeTask(),
        makeTask({
          id: "task-2",
          project_id: "proj-2",
          due_date_status: "on_track",
          suggested_due_date: "2025-07-20",
        }),
      ],
      users,
      settings: makeSettings(),
    });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].projectId).toBe("proj-1");
  });
});
