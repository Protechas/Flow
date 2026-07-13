import type { NotificationType } from "@/types/flow";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCheck,
  ClipboardCheck,
  FileUp,
  LifeBuoy,
  MessageSquare,
  Moon,
  TrendingDown,
  UserPlus,
} from "lucide-react";

export const NOTIFICATION_TYPE_ICONS: Partial<
  Record<NotificationType, typeof Bell>
> = {
  new_assignment: UserPlus,
  assignment_changed: UserPlus,
  task_due_soon: AlertTriangle,
  task_overdue: AlertTriangle,
  qa_review_needed: ClipboardCheck,
  qa_passed: ClipboardCheck,
  qa_rejected: ClipboardCheck,
  correction_issued: AlertTriangle,
  correction_resolved: CheckCheck,
  comment_mention: MessageSquare,
  file_uploaded: FileUp,
  project_at_risk: AlertTriangle,
  employee_overloaded: AlertTriangle,
  work_stuck: AlertTriangle,
  workload_low: TrendingDown,
  workload_empty: TrendingDown,
  workload_needs_estimate: TrendingDown,
  workload_clocked_idle: TrendingDown,
  activity_gap: TrendingDown,
  help_flag_raised: LifeBuoy,
  help_flag_escalated: AlertTriangle,
  help_flag_acknowledged: CheckCheck,
  help_flag_resolved: CheckCheck,
  missing_wrap_up: Moon,
  forecast_risk: TrendingDown,
  department_alert: Building2,
  side_session_heavy: TrendingDown,
};

export function notificationIcon(type: NotificationType) {
  return NOTIFICATION_TYPE_ICONS[type] ?? Bell;
}
