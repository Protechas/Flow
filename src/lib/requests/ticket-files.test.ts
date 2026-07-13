import { describe, expect, it } from "vitest";
import { createTicket } from "@/lib/requests/tickets";
import {
  deleteTicketFile,
  downloadTicketFileBuffer,
  getTicketFileById,
  listFilesForTickets,
  uploadTicketFile,
} from "@/lib/requests/ticket-files";

describe("ticket attachments", () => {
  it("uploads, lists, downloads, and removes the deliverable", async () => {
    const ticket = await createTicket({
      title: "Doc for the RAV4 bulletin",
      priority: "normal",
      requested_by: "user-mike",
    });

    const content = Buffer.from("the finished document bytes");
    const file = await uploadTicketFile({
      ticket_id: ticket.id,
      user_id: "user-analyst-1",
      file_name: "RAV4-bulletin.docx",
      mime_type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer: content,
    });
    expect(file.file_size).toBe(content.length);

    // Shows up on the ticket, attributed to the uploader
    const byTicket = await listFilesForTickets([ticket.id]);
    expect(byTicket[ticket.id]).toHaveLength(1);
    expect(byTicket[ticket.id][0].file_name).toBe("RAV4-bulletin.docx");

    // Round-trips the exact bytes — what Mike downloads is what was dropped
    const stored = await getTicketFileById(file.id);
    const downloaded = await downloadTicketFileBuffer(stored!);
    expect(downloaded.equals(content)).toBe(true);

    await deleteTicketFile(file.id);
    expect(await getTicketFileById(file.id)).toBeNull();
  });
});
