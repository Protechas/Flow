"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { notificationIcon } from "@/components/notifications/notification-meta";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/notifications/categories";
import type { Notification } from "@/types/flow";
import { formatDistanceToNow, parseISO } from "date-fns";

export function NotificationItem({
  item,
  onRead,
  compact = false,
}: {
  item: Notification;
  onRead?: (id: string) => void;
  compact?: boolean;
}) {
  const Icon = notificationIcon(item.type);
  const typeLabel = NOTIFICATION_TYPE_LABELS[item.type];

  const body = (
    <div
      className={cn(
        "flex gap-3 rounded-lg border border-transparent transition-colors",
        compact ? "p-2.5" : "p-3",
        !item.read_status && "bg-primary/8 border-primary/15",
        item.link && "hover:bg-muted/40 cursor-pointer"
      )}
      onClick={() => {
        if (!item.read_status) onRead?.(item.id);
      }}
    >
      <div
        className={cn(
          "mt-0.5 flex shrink-0 items-center justify-center rounded-md",
          compact ? "h-8 w-8" : "h-9 w-9",
          !item.read_status ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"
        )}
      >
        <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-medium leading-tight", compact ? "text-xs" : "text-sm")}>
            {item.title}
          </p>
          {!item.read_status && (
            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        {typeLabel && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80 mt-0.5">
            {typeLabel}
          </p>
        )}
        <p
          className={cn(
            "text-muted-foreground mt-1",
            compact ? "text-[11px] line-clamp-2" : "text-xs line-clamp-3"
          )}
        >
          {item.message}
        </p>
        <p className="text-[10px] text-muted-foreground/70 mt-1.5">
          {formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}
        </p>
      </div>
    </div>
  );

  if (item.link) {
    return (
      <Link href={item.link} onClick={() => onRead?.(item.id)} className="block">
        {body}
      </Link>
    );
  }

  return body;
}
