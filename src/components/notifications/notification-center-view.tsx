"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NOTIFICATION_CENTER_CATEGORIES, NOTIFICATION_CATEGORY_LABELS } from "@/lib/notifications/categories";
import type {
  Notification,
  NotificationCategory,
  NotificationReadFilter,
} from "@/types/flow";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";

export function NotificationCenterView({
  initialItems,
  initialUnread,
  compact = false,
  showViewAllLink = false,
  pollIntervalMs = 60_000,
}: {
  initialItems?: Notification[];
  initialUnread?: number;
  compact?: boolean;
  showViewAllLink?: boolean;
  pollIntervalMs?: number;
}) {
  const [items, setItems] = useState<Notification[]>(initialItems ?? []);
  const [unread, setUnread] = useState(initialUnread ?? 0);
  const [category, setCategory] = useState<NotificationCategory | "all">("all");
  const [status, setStatus] = useState<NotificationReadFilter>("all");
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = await getNotificationsAction({
        category,
        status,
        limit: compact ? 12 : 100,
      });
      setItems(data.items);
      setUnread(data.unread);
    });
  }, [category, status, compact]);

  useEffect(() => {
    if (initialItems === undefined) refresh();
  }, [initialItems, refresh]);

  useEffect(() => {
    refresh();
  }, [category, status, refresh]);

  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    const interval = setInterval(refresh, pollIntervalMs);
    return () => clearInterval(interval);
  }, [refresh, pollIntervalMs]);

  const filteredCount = useMemo(() => items.length, [items]);

  const handleRead = (id: string) => {
    startTransition(async () => {
      await markNotificationReadAction(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_status: true } : n)));
      setUnread((c) => Math.max(0, c - 1));
    });
  };

  const handleReadAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setItems((prev) => prev.map((n) => ({ ...n, read_status: true })));
      setUnread(0);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h2 className={compact ? "text-sm font-semibold" : "text-lg font-semibold"}>
              Notification Center
            </h2>
            {!compact && (
              <p className="text-xs text-muted-foreground">
                {unread > 0 ? `${unread} unread` : "All caught up"} · {filteredCount} shown
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unread > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={pending}
              onClick={handleReadAll}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
          {showViewAllLink && (
            <Button variant="ghost" size="sm" className="h-8 text-xs" render={<Link href="/notifications" />}>
              View all
              <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select
          value={category}
          onValueChange={(v) => v && setCategory(v as NotificationCategory | "all")}
        >
          <SelectTrigger className="h-8 min-w-[140px] bg-card text-foreground text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {NOTIFICATION_CENTER_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {NOTIFICATION_CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(v) => v && setStatus(v as NotificationReadFilter)}
        >
          <SelectTrigger className="h-8 min-w-[120px] bg-card text-foreground text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div
        className={
          compact
            ? "space-y-1 max-h-[320px] overflow-y-auto"
            : "enterprise-panel divide-y divide-border/30"
        }
      >
        {items.length === 0 && (
          <div className="py-12 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No notifications match your filters.</p>
          </div>
        )}
        {items.map((item) => (
          <NotificationItem
            key={item.id}
            item={item}
            onRead={handleRead}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
