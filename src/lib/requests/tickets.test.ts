import { describe, expect, it } from "vitest";
import {
  cancelTicket,
  claimTicket,
  completeTicket,
  createTicket,
  listActiveTickets,
  listTicketsForRequester,
  releaseTicket,
  setTicketPausedTask,
} from "@/lib/requests/tickets";

describe("request tickets", () => {
  it("runs the full lifecycle: submit → claim (first wins) → done", async () => {
    const ticket = await createTicket({
      title: "Doc for the 2026 RAV4 ADAS bulletin",
      details: "Email team needs it for a customer reply",
      priority: "normal",
      requested_by: "user-mike",
    });
    expect(ticket.status).toBe("open");

    const active = await listActiveTickets();
    expect(active.some((t) => t.id === ticket.id)).toBe(true);

    // First claim wins…
    const claimed = await claimTicket(ticket.id, "user-analyst-1");
    expect(claimed?.claimed_by).toBe("user-analyst-1");
    // …second claim loses cleanly (no throw, just null)
    const lost = await claimTicket(ticket.id, "user-analyst-2");
    expect(lost).toBeNull();

    const done = await completeTicket(ticket.id);
    expect(done?.status).toBe("done");
    expect(done?.completed_at).toBeTruthy();

    // Gone from the active queue, visible in the requester's history
    const activeAfter = await listActiveTickets();
    expect(activeAfter.some((t) => t.id === ticket.id)).toBe(false);
    const mine = await listTicketsForRequester("user-mike");
    expect(mine.some((t) => t.id === ticket.id && t.status === "done")).toBe(true);
  });

  it("release puts a claimed ticket back up for grabs and clears the paused-task memo", async () => {
    const ticket = await createTicket({
      title: "Need a screenshot set for training",
      priority: "low",
      requested_by: "user-mike",
    });
    await claimTicket(ticket.id, "user-analyst-1");
    // The claim remembered the task timer it paused
    const withPaused = await setTicketPausedTask(ticket.id, "task-123");
    expect(withPaused?.paused_task_id).toBe("task-123");

    const released = await releaseTicket(ticket.id);
    expect(released?.status).toBe("open");
    expect(released?.claimed_by).toBeNull();
    expect(released?.paused_task_id).toBeNull();

    // Someone else can now take it
    const reclaimed = await claimTicket(ticket.id, "user-analyst-2");
    expect(reclaimed?.claimed_by).toBe("user-analyst-2");
  });

  it("cancel closes an open ticket", async () => {
    const ticket = await createTicket({
      title: "Never mind this one",
      priority: "normal",
      requested_by: "user-mike",
    });
    const canceled = await cancelTicket(ticket.id);
    expect(canceled?.status).toBe("canceled");
    const active = await listActiveTickets();
    expect(active.some((t) => t.id === ticket.id)).toBe(false);
  });
});
