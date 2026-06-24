"use client";

import Link from "next/link";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActivityGapView } from "@/types/flow";

export function ActivityGapsPanel({
  gaps,
  compact,
}: {
  gaps: ActivityGapView[];
  compact?: boolean;
}) {
  if (gaps.length === 0) return null;

  const open = gaps.filter((g) => g.status === "open");

  return (
    <EnterpriseSection
      title="Activity gaps"
      description="Clocked sessions without an associated active work record."
      helpKey="activityGaps"
    >
      <div className="space-y-2">
        {(compact ? open.slice(0, 5) : open).map((g) => (
          <div
            key={g.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/50 px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <Link href={`/people/${g.employee_id}`} className="font-medium hover:text-primary">
                {g.employee_name}
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">{g.message}</p>
            </div>
            <Badge variant="outline">{g.gap_minutes}m</Badge>
          </div>
        ))}
      </div>
      <Button
        size="sm"
        variant="outline"
        className="mt-3 h-8 text-xs"
        render={<Link href="/reports/work-visibility#gaps" />}
      >
        View work visibility report
      </Button>
    </EnterpriseSection>
  );
}
