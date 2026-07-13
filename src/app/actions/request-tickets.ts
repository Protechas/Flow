"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, logActivityBridge } from "@/lib/data/production-bridge";
import { isTicketReceiver, listTicketReceivers } from "@/lib/requests/audience";
import { deliverNotification } from "@/lib/notifications/notifications";
import {
  getActiveTaskTimeEntry,
  pauseTaskTimer,
  resumeTaskTimer,
} from "@/lib/data/production-tracking";
import {
  cancelTicket,
  claimTicket,
  completeTicket,
  createTicket,
  getTicketById,
  linkTicketTask,
  listActiveTickets,
  releaseTicket,
  setTicketPausedTask,
} from "@/lib/requests/tickets";
import type { RequestTicketPriority, User } from "@/types/flow";

const PRIORITIES = new Set<RequestTicketPriority>(["low", "normal", "urgent"]);

/**
 * Ticket time never doubles as task time: claiming pauses the claimer's
 * running task timer (remembered on the ticket) and closing the ticket —
 * done or release — resumes exactly that timer.
 */
async function pauseTaskTimerForTicket(ticketId: string, userId: string): Promise<void> {
  const timer = getActiveTaskTimeEntry(userId);
  if (timer?.status !== "active") return;
  try {
    pauseTaskTimer(userId);
    const { persistTaskTimeEntrySync } = await import("@/lib/data/production-tracking-db");
    const paused = getActiveTaskTimeEntry(userId);
    if (paused) await persistTaskTimeEntrySync(paused);
    await setTicketPausedTask(ticketId, timer.task_id);
    logActivityBridge(userId, "time_log", "Task timer paused — working a team request", timer.task_id);
  } catch {
    // Claiming must never fail because the timer handoff hiccuped.
  }
}

async function resumeTaskTimerAfterTicket(
  pausedTaskId: string | null,
  userId: string
): Promise<void> {
  if (!pausedTaskId) return;
  const timer = getActiveTaskTimeEntry(userId);
  if (timer?.status !== "paused" || timer.task_id !== pausedTaskId) return;
  try {
    resumeTaskTimer(userId);
    const { persistTaskTimeEntrySync } = await import("@/lib/data/production-tracking-db");
    const resumed = getActiveTaskTimeEntry(userId);
    if (resumed) await persistTaskTimeEntrySync(resumed);
    logActivityBridge(userId, "time_log", "Task timer resumed — request finished", pausedTaskId);
  } catch {
    // Same: closing the ticket wins over a timer hiccup.
  }
}

const TICKET_PATHS = ["/work", "/work/requests", "/requests", "/operations"];

function revalidateTickets() {
  for (const path of TICKET_PATHS) revalidatePath(path);
}

/** The receiving crew: the configured receiving teams, or (unset) departments that carry production work. */
async function ticketAudience(users: User[]): Promise<User[]> {
  return listTicketReceivers(users);
}

export async function submitRequestTicketAction(input: {
  title: string;
  details?: string;
  priority?: RequestTicketPriority;
}) {
  const user = await requireUser();
  const title = input.title.trim();
  if (!title) return { ok: false as const, message: "Say what you need — a title is required" };
  const priority = input.priority && PRIORITIES.has(input.priority) ? input.priority : "normal";

  try {
    await ensureAppDataLoaded();
    const ticket = await createTicket({
      title,
      details: input.details,
      priority,
      requested_by: user.id,
    });

    logActivityBridge(user.id, "status_change", `Submitted request: ${title}`);
    for (const member of await ticketAudience(getFlowStore().users)) {
      if (member.id === user.id) continue;
      deliverNotification({
        user_id: member.id,
        type: "request_submitted",
        title: priority === "urgent" ? "New URGENT team request" : "New team request",
        message: `${user.full_name} needs: ${title}`,
        related_entity_type: "request_ticket",
        related_entity_id: ticket.id,
        link: "/work/requests",
      });
    }

    revalidateTickets();
    return { ok: true as const, ticket };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not submit request" };
  }
}

/** First claim wins — a losing click gets told, not errored. */
export async function claimRequestTicketAction(ticketId: string) {
  const user = await requireUser();
  if (user.role === "viewer") {
    return { ok: false as const, message: "Viewers can't claim requests" };
  }

  try {
    await ensureAppDataLoaded();
    // Requester-only groups submit; they don't claim.
    if (!(await isTicketReceiver(user)) && !hasPermission(user.role, "work:assign")) {
      return { ok: false as const, message: "Requests are handled by the receiving team" };
    }
    const ticket = await claimTicket(ticketId, user.id);
    if (!ticket) {
      revalidateTickets();
      return { ok: false as const, taken: true as const, message: "Someone else already grabbed this one" };
    }

    // The claim IS the ticket timer starting — hand the task timer off to it.
    await pauseTaskTimerForTicket(ticket.id, user.id);

    logActivityBridge(user.id, "status_change", `Claimed request: ${ticket.title}`);
    deliverNotification({
      user_id: ticket.requested_by,
      type: "request_update",
      title: "Your request was picked up",
      message: `${user.full_name} grabbed "${ticket.title}".`,
      related_entity_type: "request_ticket",
      related_entity_id: ticket.id,
      link: "/work/requests",
    });

    revalidateTickets();
    return { ok: true as const, ticket };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not claim request" };
  }
}

export async function releaseRequestTicketAction(ticketId: string) {
  const user = await requireUser();
  try {
    const ticket = await getTicketById(ticketId);
    if (!ticket || ticket.status !== "claimed") {
      return { ok: false as const, message: "This request isn't claimed" };
    }
    if (ticket.claimed_by !== user.id && !hasPermission(user.role, "work:assign")) {
      return { ok: false as const, message: "Only the person who claimed it (or a lead) can release it" };
    }
    await releaseTicket(ticketId);
    await ensureAppDataLoaded();
    if (ticket.claimed_by) {
      await resumeTaskTimerAfterTicket(ticket.paused_task_id, ticket.claimed_by);
    }
    logActivityBridge(user.id, "status_change", `Released request back to the queue: ${ticket.title}`);
    revalidateTickets();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not release request" };
  }
}

export async function completeRequestTicketAction(ticketId: string) {
  const user = await requireUser();
  try {
    const ticket = await getTicketById(ticketId);
    if (!ticket || ticket.status !== "claimed") {
      return { ok: false as const, message: "Claim the request before completing it" };
    }
    if (ticket.claimed_by !== user.id && !hasPermission(user.role, "work:assign")) {
      return { ok: false as const, message: "Only the person working it (or a lead) can complete it" };
    }
    const done = await completeTicket(ticketId);
    await ensureAppDataLoaded();
    if (ticket.claimed_by) {
      await resumeTaskTimerAfterTicket(ticket.paused_task_id, ticket.claimed_by);
    }
    const ticketMinutes =
      ticket.claimed_at != null
        ? Math.max(0, Math.round((Date.now() - new Date(ticket.claimed_at).getTime()) / 60000))
        : null;
    logActivityBridge(
      user.id,
      "status_change",
      `Completed request: ${ticket.title}${ticketMinutes != null ? ` — ${ticketMinutes}m` : ""}`
    );
    deliverNotification({
      user_id: ticket.requested_by,
      type: "request_update",
      title: "Your request is done",
      message: `${user.full_name} finished "${ticket.title}".`,
      related_entity_type: "request_ticket",
      related_entity_id: ticketId,
      link: "/work/requests",
    });
    revalidateTickets();
    return { ok: true as const, ticket: done };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not complete request" };
  }
}

export async function cancelRequestTicketAction(ticketId: string) {
  const user = await requireUser();
  try {
    const ticket = await getTicketById(ticketId);
    if (!ticket || ticket.status === "done" || ticket.status === "canceled") {
      return { ok: false as const, message: "This request is already closed" };
    }
    if (ticket.requested_by !== user.id && !hasPermission(user.role, "work:assign")) {
      return { ok: false as const, message: "Only the requester (or a lead) can cancel it" };
    }
    await cancelTicket(ticketId);
    await ensureAppDataLoaded();
    if (ticket.status === "claimed" && ticket.claimed_by) {
      await resumeTaskTimerAfterTicket(ticket.paused_task_id, ticket.claimed_by);
    }
    logActivityBridge(user.id, "status_change", `Canceled request: ${ticket.title}`);
    if (ticket.claimed_by && ticket.claimed_by !== user.id) {
      deliverNotification({
        user_id: ticket.claimed_by,
        type: "request_update",
        title: "Request canceled",
        message: `"${ticket.title}" was canceled by ${user.full_name}.`,
        related_entity_type: "request_ticket",
        related_entity_id: ticketId,
        link: "/work/requests",
      });
    }
    revalidateTickets();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not cancel request" };
  }
}

/**
 * The "mix of both": a lead escalates a claimed request into a real Flow task
 * (timers, QA, forecasting) inside a chosen project. The ticket stays linked.
 */
export async function convertRequestTicketToTaskAction(input: {
  ticketId: string;
  projectId: string;
}) {
  const user = await requireUser();
  if (!hasPermission(user.role, "work:assign")) {
    return { ok: false as const, message: "You don't have permission to create tasks" };
  }

  try {
    await ensureAppDataLoaded();
    const ticket = await getTicketById(input.ticketId);
    if (!ticket) return { ok: false as const, message: "Request not found" };
    if (ticket.linked_task_id) {
      return { ok: false as const, message: "This request already has a task" };
    }

    const store = getFlowStore();
    const requesterName =
      store.users.find((u) => u.id === ticket.requested_by)?.full_name ?? "a teammate";

    const { createQuickTask } = await import("@/lib/data/create-work-setup");
    const { persistQuickTaskChain } = await import("@/lib/data/work-items-db");
    const task = createQuickTask({
      projectId: input.projectId,
      manufacturerName: "Team Requests",
      year: new Date().getFullYear(),
      taskTitle: ticket.title,
      assignedTo: ticket.claimed_by,
      priority: ticket.priority === "urgent" ? "urgent" : "medium",
      notes: [
        `Escalated from a team request by ${requesterName}.`,
        "",
        ticket.details ?? "",
        "",
        `Request ticket \`${ticket.id}\``,
      ].join("\n"),
    });
    await persistQuickTaskChain(task);
    await linkTicketTask(ticket.id, task.id);

    logActivityBridge(user.id, "status_change", `Escalated request to task: ${ticket.title}`, task.id);
    revalidateTickets();
    revalidatePath("/projects");
    return { ok: true as const, taskId: task.id };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not create the task" };
  }
}

/** Queue data for client components that refresh in place. */
export async function listActiveTicketsAction() {
  await requireUser();
  await ensureAppDataLoaded();
  return listActiveTickets();
}

// ——— Routing: who receives tickets ———————————————————————————————————————————

/** Owner control: route requests to specific team(s), e.g. just the SI team. */
export async function setRequestRoutingAction(teamIds: string[]) {
  const user = await requireUser();
  if (!hasPermission(user.role, "work:assign")) {
    return { ok: false as const, message: "You do not have permission to change request routing" };
  }
  try {
    await ensureAppDataLoaded();
    const validIds = new Set(getFlowStore().teams.map((t) => t.id));
    const cleaned = [...new Set(teamIds)].filter((id) => validIds.has(id));
    const { setReceivingTeamIds } = await import("@/lib/requests/settings");
    await setReceivingTeamIds(cleaned, user.id);
    logActivityBridge(user.id, "status_change", "Updated request routing teams");
    revalidateTickets();
    return { ok: true as const, teamIds: cleaned };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not save routing" };
  }
}

// ——— Attachments: the deliverable travels with the ticket ———————————————————

function canTouchTicketFiles(
  ticket: { requested_by: string; claimed_by: string | null; status: string },
  userId: string,
  role: string
): boolean {
  if (ticket.status === "canceled") return false;
  return (
    ticket.requested_by === userId ||
    ticket.claimed_by === userId ||
    hasPermission(role, "work:assign")
  );
}

/** Drag-drop upload onto a ticket — requester context in, analyst deliverable out. */
export async function uploadRequestTicketFileAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!ticketId || !file?.size) {
    return { ok: false as const, message: "Drop a file on the request" };
  }

  try {
    await ensureAppDataLoaded();
    const ticket = await getTicketById(ticketId);
    if (!ticket) return { ok: false as const, message: "Request not found" };
    if (!canTouchTicketFiles(ticket, user.id, user.role)) {
      return { ok: false as const, message: "Only the requester or the person working it can attach files" };
    }

    const { uploadTicketFile } = await import("@/lib/requests/ticket-files");
    const uploaded = await uploadTicketFile({
      ticket_id: ticketId,
      user_id: user.id,
      file_name: file.name,
      mime_type: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    });

    logActivityBridge(user.id, "file_upload", `Attached ${file.name} to request: ${ticket.title}`);
    // The other side of the handoff gets told the file landed.
    const counterpart = user.id === ticket.requested_by ? ticket.claimed_by : ticket.requested_by;
    if (counterpart && counterpart !== user.id) {
      deliverNotification({
        user_id: counterpart,
        type: "request_update",
        title: "File attached to your request",
        message: `${user.full_name} attached ${file.name} to "${ticket.title}".`,
        related_entity_type: "request_ticket",
        related_entity_id: ticketId,
        link: "/work/requests",
      });
    }

    revalidateTickets();
    return { ok: true as const, file: uploaded };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Upload failed" };
  }
}

export async function deleteRequestTicketFileAction(fileId: string) {
  const user = await requireUser();
  try {
    const { deleteTicketFile, getTicketFileById } = await import("@/lib/requests/ticket-files");
    const file = await getTicketFileById(fileId);
    if (!file) return { ok: true as const };
    if (file.user_id !== user.id && !hasPermission(user.role, "work:assign")) {
      return { ok: false as const, message: "Only the uploader (or a lead) can remove a file" };
    }
    await deleteTicketFile(fileId);
    revalidateTickets();
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, message: e instanceof Error ? e.message : "Could not remove file" };
  }
}
