import { getFlowStore, initFlowStore, submitQaReview } from "@/lib/data/flow-store";
import { filterWorkPackagesToTeam } from "@/lib/auth/team-scope";
import { getWorkPackages } from "@/lib/data/work-packages";
import { listOpenBatchSubmissions } from "@/lib/data/production-tracking";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { createClient } from "@/lib/supabase/server";
import type { QaResult, QaReview, TaskSubmissionRecord, WorkPackage } from "@/types/flow";

export async function getQaQueue(teamMemberIds?: string[]) {
  let items = (await getWorkPackages()).filter((i) =>
    ["ready_for_qa", "in_qa"].includes(i.status)
  );
  if (teamMemberIds?.length) {
    items = filterWorkPackagesToTeam(items, teamMemberIds);
  }
  return items;
}

export interface BatchReviewItem {
  submission: TaskSubmissionRecord;
  task: WorkPackage;
}

/** Open batch submissions with their tasks — in-progress work awaiting a batch review. */
export async function getBatchReviewQueue(teamMemberIds?: string[]): Promise<BatchReviewItem[]> {
  let packages = await getWorkPackages();
  if (teamMemberIds?.length) {
    packages = filterWorkPackagesToTeam(packages, teamMemberIds);
  }
  const byId = new Map(packages.map((p) => [p.id, p]));
  return listOpenBatchSubmissions([...byId.keys()])
    .map((submission) => ({ submission, task: byId.get(submission.task_id)! }))
    .filter((item) => item.task);
}

export async function getQaReviews(): Promise<QaReview[]> {
  initFlowStore();
  if (!isSupabaseConfigured()) return getFlowStore().qaReviews;

  const supabase = await createClient();
  const { data, error } = await supabase.from("qa_reviews").select("*").order("reviewed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    ...r,
    work_package_id: r.work_item_id ?? r.work_package_id,
  })) as QaReview[];
}

export { submitQaReview };

export async function submitQaReviewApi(params: {
  workPackageId: string;
  reviewerId: string;
  analystId: string;
  result: QaResult;
  notes?: string;
  errorCategory?: string;
}) {
  if (!isSupabaseConfigured()) {
    return submitQaReview(
      params.workPackageId,
      params.reviewerId,
      params.analystId,
      params.result,
      params.notes,
      params.errorCategory
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("qa_reviews").insert({
    work_item_id: params.workPackageId,
    reviewer_id: params.reviewerId,
    analyst_id: params.analystId,
    result: params.result,
    notes: params.notes,
    error_category: params.errorCategory,
  }).select().single();
  if (error) throw error;

  // Run the same in-memory decision flow the demo path uses — it moves the
  // package to done/correction_needed, bumps correction counts, and fires the
  // workflow notifications. Then persist the package, or the new status only
  // lives in this server instance and reverts on the next request.
  submitQaReview(
    params.workPackageId,
    params.reviewerId,
    params.analystId,
    params.result,
    params.notes,
    params.errorCategory
  );
  const { persistPackageState } = await import("@/lib/production/persist-helpers");
  await persistPackageState(params.workPackageId);

  return data;
}
