import Link from "next/link";
import { EnterpriseStatusBadge } from "@/components/enterprise/enterprise-status-badge";
import { EmptyState } from "@/components/enterprise/empty-state";
import { ActiveStatusIndicator } from "@/components/platform/active-status-indicator";
import { activityEventHref } from "@/lib/navigation/deep-links";
import type { ActivityEvent, ActivityEventType } from "@/types/flow";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  Activity,
  CheckCircle2,
  FileUp,
  LifeBuoy,
  MessageSquare,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import type { EnterpriseSemanticVariant } from "@/lib/design/status-system";
import type { LucideIcon } from "lucide-react";

const ACTIVITY_META: Record<
  ActivityEventType,
  { label: string; variant: EnterpriseSemanticVariant; icon: LucideIcon }
> = {
  status_change: { label: "Status", variant: "info", icon: Activity },
  assignment: { label: "Assignment", variant: "info", icon: UserPlus },
  time_log: { label: "Time", variant: "neutral", icon: Activity },
  qa_review: { label: "QA", variant: "qa", icon: ShieldCheck },
  comment: { label: "Comment", variant: "neutral", icon: MessageSquare },
  file_upload: { label: "File", variant: "success", icon: FileUp },
  submit_qa: { label: "QA Submit", variant: "qa", icon: Send },
  task_complete: { label: "Complete", variant: "success", icon: CheckCircle2 },
  correction_received: { label: "Correction", variant: "warning", icon: ShieldCheck },
  correction_resolved: { label: "Resolved", variant: "success", icon: CheckCircle2 },
  help_flag: { label: "Help", variant: "warning", icon: LifeBuoy },
};

export function ActivityFeed({
  events,
  maxItems = 12,
  emptyTitle = "No recent activity",
  emptyDescription = "Activity will appear here as work moves through the system.",
}: {
  events: ActivityEvent[];
  maxItems?: number;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const items = [...events]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, maxItems);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title={emptyTitle}
        description={emptyDescription}
        className="border-0 bg-transparent py-8"
      />
    );
  }

  return (
    <ul className="divide-y divide-border/60">
      {items.map((event) => {
        const meta = ACTIVITY_META[event.type] ?? ACTIVITY_META.status_change;
        const Icon = meta.icon;
        const href = activityEventHref(event);
        const isRecent = event.created_at >= new Date(Date.now() - 5 * 60 * 1000).toISOString();

        return (
          <li key={event.id} className="flow-activity-item">
            {href ? (
              <Link
                href={href}
                className="flex gap-3 py-3 enterprise-row-hover px-1 -mx-1 rounded-sm cursor-pointer group"
                title="Open related record"
              >
                <div className="relative">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-muted/60 text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {isRecent && (
                    <ActiveStatusIndicator
                      status="active"
                      live
                      className="absolute -right-0.5 -top-0.5"
                      title="Recent activity"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <EnterpriseStatusBadge label={meta.label} variant={meta.variant} size="sm" />
                    <span className="flow-meta">
                      {formatDistanceToNow(parseISO(event.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1 leading-snug">{event.summary}</p>
                </div>
              </Link>
            ) : (
              <div className="flex gap-3 py-3 px-1 -mx-1 rounded-sm group">
                <div className="relative">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-muted/60 text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  {isRecent && (
                    <ActiveStatusIndicator
                      status="active"
                      live
                      className="absolute -right-0.5 -top-0.5"
                      title="Recent activity"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <EnterpriseStatusBadge label={meta.label} variant={meta.variant} size="sm" />
                    <span className="flow-meta">
                      {formatDistanceToNow(parseISO(event.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground mt-1 leading-snug">{event.summary}</p>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
