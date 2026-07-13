import { describe, expect, it } from "vitest";
import { isTicketReceiver, listTicketReceivers } from "@/lib/requests/audience";
import { setReceivingTeamIds } from "@/lib/requests/settings";
import { createDepartment, createTeam, getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { createUserRecord } from "@/lib/data/users";
import type { User } from "@/types/flow";

async function makeStoreUser(id: string, teamId: string, isActive = true): Promise<User> {
  return createUserRecord({
    id,
    email: `${id}@flow.local`,
    first_name: "Test",
    last_name: id,
    full_name: `Test ${id}`,
    role: "employee",
    team_id: teamId,
    manager_id: null,
    hire_date: null,
    pay_type: "salary",
    avatar_url: null,
    last_login_at: null,
    is_active: isActive,
  });
}

describe("ticket audience routing", () => {
  it("production-department analysts receive; a no-projects department is submit-only", async () => {
    initFlowStore();
    const store = getFlowStore();

    // An SI analyst (team in the department that owns active projects) receives
    const siTeam = store.teams.find((t) => t.department_id);
    expect(siTeam).toBeDefined();
    const analyst = await makeStoreUser("test-si-analyst", siTeam!.id);
    expect(await isTicketReceiver(analyst)).toBe(true);

    // The Email Team: its own department, zero projects → submit-only
    const emailDept = createDepartment({ name: "Email Team" });
    const emailTeam = createTeam({ name: "Email Squad", department_id: emailDept.id });
    const mike = await makeStoreUser("test-mike", emailTeam.id);
    expect(await isTicketReceiver(mike)).toBe(false);

    // Inactive users never receive
    const gone = await makeStoreUser("test-gone", siTeam!.id, false);
    expect(await isTicketReceiver(gone)).toBe(false);
  });

  it("explicit routing wins: only the picked team receives", async () => {
    initFlowStore();
    const store = getFlowStore();
    const [teamA, teamB] = store.teams;
    expect(teamA && teamB).toBeTruthy();

    const onPicked = await makeStoreUser("test-picked", teamA.id);
    const offPicked = await makeStoreUser("test-not-picked", teamB.id);

    await setReceivingTeamIds([teamA.id], "test-owner");
    try {
      expect(await isTicketReceiver(onPicked)).toBe(true);
      expect(await isTicketReceiver(offPicked)).toBe(false);

      const receivers = await listTicketReceivers([onPicked, offPicked]);
      expect(receivers.map((u) => u.id)).toEqual(["test-picked"]);
    } finally {
      await setReceivingTeamIds([], "test-owner");
    }
  });
});
