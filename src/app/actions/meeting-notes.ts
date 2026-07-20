"use server";

import { AI_DISABLED_MESSAGE, isAiEnabled } from "@/lib/ai/client";
import {
  eddyMeetingDigest,
  TRANSCRIPT_CHAR_CAP,
  type EddyMeetingDigest,
} from "@/lib/ai/meeting-notes";
import { normalizeRole } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/session";
import {
  createFlowNativeDocument,
  saveCompanyDocumentContent,
} from "@/lib/files/company-documents";
import {
  createDocumentFolder,
  listDocumentFolders,
} from "@/lib/files/document-folders";

/** Same crowd that can open /tools — leads and up. */
const TOOL_ROLES = new Set(["admin", "super_admin", "senior_manager", "manager", "teamlead"]);
const NOTES_FOLDER = "Meeting Notes";

/**
 * Manual-start digest (owner's rule: anything that costs money is a button).
 * The transcript goes straight to the review call and is never stored — only
 * the notes the lead chooses to save land in Files.
 */
export async function eddyMeetingDigestAction(input: {
  transcript: string;
  title?: string;
  date?: string;
}): Promise<{ ok: true; digest: EddyMeetingDigest } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!TOOL_ROLES.has(normalizeRole(user.role))) {
    return { ok: false, message: "Meeting Notes is available to leads and managers" };
  }
  if (!isAiEnabled()) {
    return { ok: false, message: AI_DISABLED_MESSAGE };
  }
  const transcript = input.transcript?.trim();
  if (!transcript || transcript.length < 80) {
    return { ok: false, message: "Paste the meeting transcript first (a few lines minimum)" };
  }
  if (transcript.length > TRANSCRIPT_CHAR_CAP) {
    return {
      ok: false,
      message: `That transcript is very long — trim it under ${Math.round(TRANSCRIPT_CHAR_CAP / 1000)}k characters`,
    };
  }

  try {
    const digest = await eddyMeetingDigest({
      transcript,
      meetingTitle: input.title,
      meetingDate: input.date,
      userId: user.id,
    });
    return { ok: true, digest };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Eddy could not digest this transcript",
    };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function notesHtml(input: {
  title: string;
  date: string;
  attendees?: string;
  digest: EddyMeetingDigest;
  savedBy: string;
}): string {
  const { digest } = input;
  const parts = [
    `<h1>${escapeHtml(input.title)}</h1>`,
    `<p><strong>Date:</strong> ${escapeHtml(input.date)}${
      input.attendees ? ` · <strong>Attendees:</strong> ${escapeHtml(input.attendees)}` : ""
    }</p>`,
    `<h2>Summary</h2>`,
    `<p>${escapeHtml(digest.summary)}</p>`,
  ];
  if (digest.decisions.length) {
    parts.push(
      `<h2>Decisions</h2>`,
      `<ul>${digest.decisions.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
    );
  }
  if (digest.actionItems.length) {
    parts.push(
      `<h2>Action items</h2>`,
      `<ul>${digest.actionItems
        .map((a) => {
          const meta = [
            a.suggestedAssignee ? `owner: ${a.suggestedAssignee}` : null,
            a.due ? `due ${a.due}` : null,
            a.priority !== "medium" ? a.priority : null,
          ]
            .filter(Boolean)
            .join(" · ");
          return `<li><strong>${escapeHtml(a.title)}</strong>${
            meta ? ` <em>(${escapeHtml(meta)})</em>` : ""
          }${a.detail ? `<br/>${escapeHtml(a.detail)}` : ""}</li>`;
        })
        .join("")}</ul>`
    );
  }
  parts.push(
    `<p><em>Digested by Eddy · saved by ${escapeHtml(input.savedBy)} · ${new Date()
      .toISOString()
      .slice(0, 10)}</em></p>`
  );
  return parts.join("\n");
}

/** Save the digested notes as a Flow-native document in Files → Meeting Notes. */
export async function saveMeetingNotesAction(input: {
  title: string;
  date: string;
  attendees?: string;
  digest: EddyMeetingDigest;
}): Promise<{ ok: true; documentId: string } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!TOOL_ROLES.has(normalizeRole(user.role))) {
    return { ok: false, message: "Saving meeting notes is available to leads and managers" };
  }
  const title = input.title?.trim() || "Team meeting";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")
    ? input.date
    : new Date().toISOString().slice(0, 10);

  try {
    const folders = await listDocumentFolders();
    let folder = folders.find((f) => f.name === NOTES_FOLDER);
    if (!folder) {
      folder = await createDocumentFolder({
        name: NOTES_FOLDER,
        parent_id: null,
        created_by: user.id,
      });
    }
    const doc = await createFlowNativeDocument({
      title: `${title} — ${date}`,
      description: "Meeting notes digested by Eddy from the meeting transcript.",
      category: "reference",
      folder_id: folder.id,
      tags: ["meeting-notes", "eddy"],
      created_by: user.id,
    });
    await saveCompanyDocumentContent(
      doc.id,
      notesHtml({ title, date, attendees: input.attendees, digest: input.digest, savedBy: user.full_name }),
      user.id
    );
    return { ok: true, documentId: doc.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not save the notes" };
  }
}
