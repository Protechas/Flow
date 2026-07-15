"use server";

import {
  eddyModelReport,
  eddyReviewContent,
  type EddyContentReview,
  type EddyModelReport,
} from "@/lib/ai/content-review";
import { isAiEnabled, AI_DISABLED_MESSAGE } from "@/lib/ai/client";
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

/**
 * Manual-start Eddy content review (owner's rule: free checks run themselves,
 * anything that costs money is a button). The document text arrives from the
 * client because extraction happens in the browser — the server never stores
 * it, it goes straight to the review call and is discarded.
 */
export async function eddyReviewContentAction(input: {
  fileName: string;
  claim: string;
  text: string;
  structuralNote?: string;
}): Promise<{ ok: true; review: EddyContentReview } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!TOOL_ROLES.has(normalizeRole(user.role))) {
    return { ok: false, message: "Eddy reviews are available to leads and managers" };
  }
  if (!isAiEnabled()) {
    return { ok: false, message: AI_DISABLED_MESSAGE };
  }
  if (!input.fileName?.trim() || typeof input.text !== "string") {
    return { ok: false, message: "Nothing to review" };
  }

  try {
    const review = await eddyReviewContent({
      fileName: input.fileName,
      claim: input.claim || input.fileName,
      text: input.text,
      structuralNote: input.structuralNote,
      userId: user.id,
    });
    return { ok: true, review };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Eddy could not review this document" };
  }
}

/** Eddy writes the model-level audit report from check results. */
export async function eddyModelReportAction(input: {
  modelLabel: string;
  coverageSummary: string;
  docLines: string[];
}): Promise<{ ok: true; report: EddyModelReport } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!TOOL_ROLES.has(normalizeRole(user.role))) {
    return { ok: false, message: "Model reports are available to leads and managers" };
  }
  if (!isAiEnabled()) return { ok: false, message: AI_DISABLED_MESSAGE };
  if (!input.modelLabel?.trim() || !input.docLines?.length) {
    return { ok: false, message: "Run an audit first — there's nothing to report on" };
  }

  try {
    const report = await eddyModelReport({
      modelLabel: input.modelLabel,
      coverageSummary: input.coverageSummary,
      docLines: input.docLines.slice(0, 120),
      userId: user.id,
    });
    return { ok: true, report };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Eddy could not build the report" };
  }
}

const REPORTS_FOLDER = "Content Audit Reports";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function reportHtml(modelLabel: string, coverageSummary: string, report: EddyModelReport, author: string): string {
  const risks = report.risks
    .map((r) => `<li><strong>${esc(r.severity.toUpperCase())}:</strong> ${esc(r.issue)}</li>`)
    .join("");
  return (
    `<h1>Content Audit — ${esc(modelLabel)}</h1>` +
    `<p>Generated ${new Date().toLocaleString()} · run by ${esc(author)} · Eddy's read is advisory — humans decide.</p>` +
    `<h2>Overview</h2><p>${esc(report.overview)}</p>` +
    `<h2>Component coverage</h2><pre>${esc(coverageSummary)}</pre>` +
    (report.strengths.length
      ? `<h2>In good shape</h2><ul>${report.strengths.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>`
      : "") +
    (report.risks.length ? `<h2>Risks</h2><ul>${risks}</ul>` : "") +
    (report.actions.length
      ? `<h2>Recommended actions</h2><ol>${report.actions.map((a) => `<li>${esc(a)}</li>`).join("")}</ol>`
      : "")
  );
}

/** File the report into Flow's document library so it outlives the browser tab. */
export async function saveModelReportAction(input: {
  modelLabel: string;
  coverageSummary: string;
  report: EddyModelReport;
}): Promise<{ ok: true; documentId: string } | { ok: false; message: string }> {
  const user = await requireUser();
  if (!TOOL_ROLES.has(normalizeRole(user.role))) {
    return { ok: false, message: "Saving reports is available to leads and managers" };
  }
  try {
    const folders = await listDocumentFolders();
    let folder = folders.find((f) => f.name === REPORTS_FOLDER);
    if (!folder) {
      folder = await createDocumentFolder({
        name: REPORTS_FOLDER,
        parent_id: null,
        created_by: user.id,
      });
    }
    const doc = await createFlowNativeDocument({
      title: `Content Audit — ${input.modelLabel} — ${new Date().toISOString().slice(0, 10)}`,
      description: "Eddy model audit report from the Content Audit tool.",
      category: "reference",
      folder_id: folder.id,
      tags: ["content-audit", "eddy"],
      created_by: user.id,
    });
    await saveCompanyDocumentContent(
      doc.id,
      reportHtml(input.modelLabel, input.coverageSummary, input.report, user.full_name),
      user.id
    );
    return { ok: true, documentId: doc.id };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not save the report" };
  }
}
