import { describe, expect, it } from "vitest";
import {
  createWorkPackage,
  getFlowStore,
  initFlowStore,
  updateWorkPackage,
} from "@/lib/data/flow-store";

describe("task default ordering", () => {
  it("keeps build order — editing a task must not move it", () => {
    initFlowStore();
    const store = getFlowStore();
    const year = store.yearWorkItems[0];
    expect(year).toBeDefined();

    const base = {
      project_id: year.project_id,
      manufacturer_id: year.manufacturer_id,
      year_work_item_id: year.id,
      year: year.year,
      status: "not_started" as const,
      priority: "medium" as const,
      estimated_hours: 1,
    };
    const first = createWorkPackage({ ...base, title: "Built first" });
    const second = createWorkPackage({ ...base, title: "Built second" });

    const order = () =>
      getFlowStore()
        .workPackages.filter((p) => p.id === first.id || p.id === second.id)
        .map((p) => p.title);

    expect(order()).toEqual(["Built first", "Built second"]);

    // Edit the first task — it must stay first
    updateWorkPackage(first.id, { notes: "edited after the fact" });
    expect(order()).toEqual(["Built first", "Built second"]);
  });
});
