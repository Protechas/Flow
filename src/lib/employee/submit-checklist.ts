import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import {
  getActiveTaskTimeEntry,
  getPendingSessionTaskMinutes,
  getTaskFileCount,
} from "@/lib/data/production-tracking";
import { getWorkEligibility } from "@/lib/work-eligibility";
import type { User } from "@/types/flow";

export interface SubmitChecklistItem {
  id: string;
  label: string;
  complete: boolean;
  required: boolean;
}

export interface TaskSubmitChecklist {
  ready: boolean;
  items: SubmitChecklistItem[];
  fileCount: number;
}

export function buildTaskSubmitChecklist(
  user: Pick<User, "id" | "role" | "pay_type" | "is_active">,
  taskId: string
): TaskSubmitChecklist {
  initFlowStore();
  const pkg = getFlowStore().workPackages.find((p) => p.id === taskId);
  const eligibility = getWorkEligibility(user);
  const fileCount = getTaskFileCount(taskId);
  const totalMinutes = getPendingSessionTaskMinutes(taskId, user.id);
  const activeTimer = getActiveTaskTimeEntry(user.id);
  const hasActivity = totalMinutes > 0 || activeTimer?.task_id === taskId;

  const docTotal = pkg?.estimated_document_count ?? 0;
  const docDone = pkg?.current_documents_completed ?? pkg?.file_count ?? 0;
  const needsDocCount = docTotal > 0;

  const items: SubmitChecklistItem[] = [
    {
      id: "clocked_in",
      label: "Clocked in",
      complete: eligibility.eligible,
      required: eligibility.requiresClockIn,
    },
    {
      id: "task_activity",
      label: "Task activity recorded",
      complete: hasActivity,
      required: true,
    },
    {
      id: "required_files",
      label: "Required files uploaded",
      complete: fileCount >= 1,
      required: true,
    },
  ];

  if (needsDocCount) {
    items.push({
      id: "document_progress",
      label: "Document progress entered",
      complete: docDone > 0,
      required: false,
    });
  }

  const ready = items.filter((i) => i.required).every((i) => i.complete);

  return { ready, items, fileCount };
}
