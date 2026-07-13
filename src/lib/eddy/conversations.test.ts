import { describe, expect, it } from "vitest";
import {
  appendMessage,
  createConversation,
  getOrCreateConversation,
  listMessages,
} from "@/lib/eddy/conversations";

describe("Eddy conversations — per-user isolation", () => {
  it("keeps Dusty's thread and Tara's thread completely separate", async () => {
    const dustyThread = await getOrCreateConversation("user-dusty");
    const taraThread = await getOrCreateConversation("user-tara-iso");

    expect(dustyThread.id).not.toBe(taraThread.id);

    await appendMessage({
      conversationId: dustyThread.id,
      userId: "user-dusty",
      role: "user",
      content: "What's stuck on Chevy 2022?",
    });
    await appendMessage({
      conversationId: taraThread.id,
      userId: "user-tara-iso",
      role: "user",
      content: "How do I pass a QA review?",
    });

    // Each user sees only their own messages
    const dustyMsgs = await listMessages(dustyThread.id, "user-dusty");
    const taraMsgs = await listMessages(taraThread.id, "user-tara-iso");
    expect(dustyMsgs.map((m) => m.content)).toEqual(["What's stuck on Chevy 2022?"]);
    expect(taraMsgs.map((m) => m.content)).toEqual(["How do I pass a QA review?"]);

    // A stolen conversation id gets NOTHING across the user boundary
    const crossRead = await listMessages(dustyThread.id, "user-tara-iso");
    expect(crossRead).toEqual([]);
    await expect(
      appendMessage({
        conversationId: dustyThread.id,
        userId: "user-tara-iso",
        role: "user",
        content: "sneaky",
      })
    ).rejects.toThrow();

    // Resuming returns your own latest thread, never someone else's
    const resumed = await getOrCreateConversation("user-dusty");
    expect(resumed.id).toBe(dustyThread.id);
  });

  it("new chat starts a fresh thread and becomes the active one", async () => {
    const first = await getOrCreateConversation("user-fresh");
    await appendMessage({
      conversationId: first.id,
      userId: "user-fresh",
      role: "user",
      content: "old topic",
    });
    const second = await createConversation("user-fresh");
    expect(second.id).not.toBe(first.id);
    expect(await listMessages(second.id, "user-fresh")).toEqual([]);
  });
});
