import { OPS_COPY } from "@/lib/copy/executive-terminology";
import Link from "next/link";
import { ActiveStatusIndicator } from "@/components/platform/active-status-indicator";
import { cn } from "@/lib/utils";
import type { CommandCenterInsight } from "@/types/flow";

function insightStatus(priority: CommandCenterInsight["priority"]) {
  if (priority === "high") return "critical" as const;
  if (priority === "medium") return "attention" as const;
  return "idle" as const;
}

export function OperationalInsightList({
  insights,
  maxItems = 5,
  className,
}: {
  insights: CommandCenterInsight[];
  maxItems?: number;
  className?: string;
}) {
  const items = insights.slice(0, maxItems);
  if (!items.length) return null;

  return (
    <div className={cn("enterprise-panel-elevated px-4 py-2", className)}>
      <p className="enterprise-label px-0 pt-2 pb-1">{OPS_COPY.businessInsights}</p>
      <ul>
        {items.map((insight) => {
          const row = (
            <>
              <ActiveStatusIndicator status={insightStatus(insight.priority)} live={insight.priority === "high"} />
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-snug">{insight.text}</p>
                <p className="flow-meta mt-0.5">{insight.metric}</p>
              </div>
            </>
          );

          return (
            <li key={insight.id}>
              {insight.drilldownHref ? (
                <Link href={insight.drilldownHref} className="flow-insight-row">
                  {row}
                </Link>
              ) : (
                <div className="flow-insight-row">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
