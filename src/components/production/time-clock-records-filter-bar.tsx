"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FilterToolbar } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildTimeClockRecordsHref,
  clockRecordRangeForPreset,
  defaultClockRecordDateRange,
  isDefaultClockRecordDateRange,
  type ClockRecordDateRange,
} from "@/lib/time-clock/record-filters";
import { formatAppDateTimeFull } from "@/lib/datetime/timezone";
import { parseISO } from "date-fns";
import { X } from "lucide-react";

export function TimeClockRecordsFilterBar({
  range,
  onRangeChange,
  employeeId,
  syncToUrl = false,
  resultCount,
}: {
  range: ClockRecordDateRange;
  onRangeChange: (range: ClockRecordDateRange) => void;
  employeeId?: string;
  syncToUrl?: boolean;
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const applyRange = useCallback(
    (next: ClockRecordDateRange) => {
      onRangeChange(next);
      if (!syncToUrl) return;
      router.push(buildTimeClockRecordsHref(pathname, next, employeeId));
    },
    [onRangeChange, syncToUrl, router, pathname, employeeId]
  );

  function formatRangeLabel(from: string, to: string) {
    try {
      const fromLabel = formatAppDateTimeFull(parseISO(`${from}T12:00:00`).toISOString());
      const toLabel = formatAppDateTimeFull(parseISO(`${to}T12:00:00`).toISOString());
      return from === to ? fromLabel.split(",")[0] : `${fromLabel.split(",")[0]} – ${toLabel.split(",")[0]}`;
    } catch {
      return `${from} – ${to}`;
    }
  }

  return (
    <div className="space-y-2">
      <FilterToolbar label="Filter by date">
        <div className="flex items-center gap-2">
          <Label htmlFor="clock-from" className="text-xs text-muted-foreground shrink-0">
            From
          </Label>
          <Input
            id="clock-from"
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => applyRange({ ...range, from: e.target.value })}
            className="h-8 w-[150px] text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="clock-to" className="text-xs text-muted-foreground shrink-0">
            To
          </Label>
          <Input
            id="clock-to"
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => applyRange({ ...range, to: e.target.value })}
            className="h-8 w-[150px] text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              { label: "Today", days: 1 },
              { label: "7 days", days: 7 },
              { label: "14 days", days: 14 },
              { label: "30 days", days: 30 },
              { label: "90 days", days: 90 },
            ] as const
          ).map(({ label, days }) => (
            <Button
              key={days}
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => applyRange(clockRecordRangeForPreset(days))}
            >
              {label}
            </Button>
          ))}
        </div>

        {!isDefaultClockRecordDateRange(range) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => applyRange(defaultClockRecordDateRange())}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Reset dates
          </Button>
        )}
      </FilterToolbar>

      <p className="text-xs text-muted-foreground px-1">
        {resultCount} punch{resultCount === 1 ? "" : "es"} · {formatRangeLabel(range.from, range.to)}
      </p>
    </div>
  );
}
