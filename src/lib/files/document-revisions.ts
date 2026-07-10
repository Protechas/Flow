import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { deliverNotification } from "@/lib/notifications/notifications";
import type {
  CompanyDocument,
  DocumentRevision,
  RevisionBlockChange,
  User,
} from "@/types/flow";

/** Roles that must read and accept every published SOP revision. */
export function requiresSopAcknowledgment(role: User["role"]): boolean {
  return role === "employee" || role === "teamlead";
}

function ts() {
  return new Date().toISOString();
}

// --- Block-level diff --------------------------------------------------------

/** Top-level blocks the in-Flow editor produces. Nested lists may merge into
 * one block — acceptable: diff granularity degrades, correctness doesn't. */
const BLOCK_RE = /<(h[1-6]|p|ul|ol|table|blockquote|pre)\b[\s\S]*?<\/\1>|<hr\s*\/?>/gi;

function splitBlocks(html: string): string[] {
  const blocks = html.match(BLOCK_RE);
  if (blocks && blocks.length > 0) return blocks;
  return html.trim() ? [html] : [];
}

/** Formatting-immune fingerprint: tags, entities, punctuation spacing, and
 * case never count as a "change" — only the words and numbers do. */
function normalizeBlock(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const MAX_CHANGED_BLOCKS = 60;

/** LCS over normalized block text; unmatched old/new blocks pair up as "changed". */
export function diffBlocks(prevHtml: string, nextHtml: string): RevisionBlockChange[] {
  const prev = splitBlocks(prevHtml);
  const next = splitBlocks(nextHtml);
  const a = prev.map(normalizeBlock);
  const b = next.map(normalizeBlock);

  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const changes: RevisionBlockChange[] = [];
  const removedBuffer: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) {
      while (removedBuffer.length) {
        changes.push({ type: "removed", html: "", prev_html: removedBuffer.shift()! });
      }
      i++;
      j++;
    } else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
      removedBuffer.push(prev[i]);
      i++;
    } else {
      const prevBlock = removedBuffer.shift();
      changes.push(
        prevBlock !== undefined
          ? { type: "changed", html: next[j], prev_html: prevBlock }
          : { type: "added", html: next[j], prev_html: "" }
      );
      j++;
    }
  }
  while (removedBuffer.length) {
    changes.push({ type: "removed", html: "", prev_html: removedBuffer.shift()! });
  }
  return changes.slice(0, MAX_CHANGED_BLOCKS);
}

// --- Persistence -------------------------------------------------------------

let memoryRevisions: DocumentRevision[] = [];
let memoryAcks: { revision_id: string; user_id: string; acknowledged_at: string }[] = [];

function mapRevision(row: Record<string, unknown>): DocumentRevision {
  return {
    id: String(row.id),
    document_id: String(row.document_id),
    revision_number: Number(row.revision_number ?? 1),
    title: String(row.title),
    content_html: String(row.content_html ?? ""),
    change_summary: String(row.change_summary ?? ""),
    changed_blocks: (row.changed_blocks ?? []) as RevisionBlockChange[],
    requires_acknowledgment: Boolean(row.requires_acknowledgment ?? true),
    published_by: row.published_by != null ? String(row.published_by) : null,
    published_at: String(row.published_at),
  };
}

async function getLatestRevision(documentId: string): Promise<DocumentRevision | null> {
  if (!isSupabaseConfigured()) {
    return (
      [...memoryRevisions]
        .filter((r) => r.document_id === documentId)
        .sort((a, b) => b.revision_number - a.revision_number)[0] ?? null
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_revisions")
    .select("*")
    .eq("document_id", documentId)
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRevision(data) : null;
}

/** Snapshot the current in-Flow content as a new revision and notify the team. */
export async function publishDocumentRevision(input: {
  document: CompanyDocument;
  contentHtml: string;
  changeSummary: string;
  publishedBy: string;
}): Promise<{ revision: DocumentRevision; notified: number }> {
  const prior = await getLatestRevision(input.document.id);
  const revision: DocumentRevision = {
    id: randomUUID(),
    document_id: input.document.id,
    revision_number: (prior?.revision_number ?? 0) + 1,
    title: input.document.title,
    content_html: input.contentHtml,
    change_summary: input.changeSummary.trim(),
    // First publish is the baseline — everything is "new", so no diff noise.
    changed_blocks: prior ? diffBlocks(prior.content_html, input.contentHtml) : [],
    requires_acknowledgment: true,
    published_by: input.publishedBy,
    published_at: ts(),
  };

  if (!isSupabaseConfigured()) {
    memoryRevisions = [...memoryRevisions, revision];
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("document_revisions")
      .insert({
        id: revision.id,
        document_id: revision.document_id,
        revision_number: revision.revision_number,
        title: revision.title,
        content_html: revision.content_html,
        change_summary: revision.change_summary,
        changed_blocks: revision.changed_blocks,
        requires_acknowledgment: true,
        published_by: revision.published_by,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    revision.published_at = String((data as Record<string, unknown>).published_at);

    const { error: pointerError } = await supabase
      .from("company_documents")
      .update({ current_revision_id: revision.id })
      .eq("id", revision.document_id);
    if (pointerError) throw new Error(pointerError.message);
  }

  // Alert everyone who must acknowledge — the gate does the actual blocking.
  initFlowStore();
  const targets = getFlowStore().users.filter(
    (u) => u.is_active && requiresSopAcknowledgment(u.role) && u.id !== input.publishedBy
  );
  for (const user of targets) {
    deliverNotification(
      {
        user_id: user.id,
        type: "sop_updated",
        title: `SOP updated: ${revision.title}`,
        message: revision.change_summary,
        related_entity_type: "document_revision",
        related_entity_id: revision.id,
        link:
          user.role === "employee"
            ? `/work/files/view/company/${revision.document_id}`
            : `/files/view/company/${revision.document_id}`,
      },
      24,
      true
    );
  }

  return { revision, notified: targets.length };
}

/** Current revisions this user still has to read and accept. Cheap: three
 * small indexed queries; usually returns nothing. */
export async function listPendingRevisionsForUser(
  userId: string
): Promise<DocumentRevision[]> {
  if (!isSupabaseConfigured()) {
    const latestByDoc = new Map<string, DocumentRevision>();
    for (const rev of memoryRevisions) {
      const cur = latestByDoc.get(rev.document_id);
      if (!cur || rev.revision_number > cur.revision_number) {
        latestByDoc.set(rev.document_id, rev);
      }
    }
    return [...latestByDoc.values()].filter(
      (rev) =>
        rev.requires_acknowledgment &&
        rev.published_by !== userId &&
        !memoryAcks.some((a) => a.revision_id === rev.id && a.user_id === userId)
    );
  }

  const supabase = await createClient();
  const { data: docs, error: docsError } = await supabase
    .from("company_documents")
    .select("current_revision_id")
    .not("current_revision_id", "is", null);
  if (docsError) throw new Error(docsError.message);
  const revisionIds = (docs ?? [])
    .map((d) => d.current_revision_id as string | null)
    .filter((id): id is string => Boolean(id));
  if (revisionIds.length === 0) return [];

  const { data: acks, error: acksError } = await supabase
    .from("document_acknowledgments")
    .select("revision_id")
    .eq("user_id", userId)
    .in("revision_id", revisionIds);
  if (acksError) throw new Error(acksError.message);
  const acked = new Set((acks ?? []).map((a) => String(a.revision_id)));
  const pendingIds = revisionIds.filter((id) => !acked.has(id));
  if (pendingIds.length === 0) return [];

  const { data: revisions, error: revError } = await supabase
    .from("document_revisions")
    .select("*")
    .in("id", pendingIds)
    .eq("requires_acknowledgment", true)
    .neq("published_by", userId);
  if (revError) throw new Error(revError.message);
  return (revisions ?? []).map(mapRevision);
}

export async function acknowledgeRevision(revisionId: string, userId: string): Promise<void> {
  if (!isSupabaseConfigured()) {
    if (!memoryAcks.some((a) => a.revision_id === revisionId && a.user_id === userId)) {
      memoryAcks = [...memoryAcks, { revision_id: revisionId, user_id: userId, acknowledged_at: ts() }];
    }
    return;
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("document_acknowledgments")
    .upsert(
      { revision_id: revisionId, user_id: userId },
      { onConflict: "revision_id,user_id", ignoreDuplicates: true }
    );
  if (error) throw new Error(error.message);
}

export interface AcknowledgmentStatus {
  revision: DocumentRevision;
  acknowledged: { userId: string; name: string; at: string }[];
  pending: { userId: string; name: string }[];
}

/** Who has accepted the current revision of a document — the receipt. */
export async function getAcknowledgmentStatus(
  documentId: string
): Promise<AcknowledgmentStatus | null> {
  const revision = await getLatestRevision(documentId);
  if (!revision) return null;

  initFlowStore();
  const required = getFlowStore().users.filter(
    (u) => u.is_active && requiresSopAcknowledgment(u.role) && u.id !== revision.published_by
  );

  let ackRows: { user_id: string; acknowledged_at: string }[];
  if (!isSupabaseConfigured()) {
    ackRows = memoryAcks
      .filter((a) => a.revision_id === revision.id)
      .map((a) => ({ user_id: a.user_id, acknowledged_at: a.acknowledged_at }));
  } else {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("document_acknowledgments")
      .select("user_id, acknowledged_at")
      .eq("revision_id", revision.id);
    if (error) throw new Error(error.message);
    ackRows = (data ?? []).map((a) => ({
      user_id: String(a.user_id),
      acknowledged_at: String(a.acknowledged_at),
    }));
  }
  const ackByUser = new Map(ackRows.map((a) => [a.user_id, a.acknowledged_at]));

  return {
    revision,
    acknowledged: required
      .filter((u) => ackByUser.has(u.id))
      .map((u) => ({ userId: u.id, name: u.full_name, at: ackByUser.get(u.id)! })),
    pending: required
      .filter((u) => !ackByUser.has(u.id))
      .map((u) => ({ userId: u.id, name: u.full_name })),
  };
}
