"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { NotificationItem } from "@/components/notifications/notification-item";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import type { Notification } from "@/types/flow";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await getNotificationsAction({ limit: 20, status: "all" });
        setItems(data.items);
        setUnread(data.unread);
      } catch {
        // Supabase busy — keep page alive; bell shows empty until next refresh.
      }
    });
  }, []);

  // Only fetch when opened — mount-time server actions were crashing /operations
  // with "An unexpected response was received from the server" during Supabase load.
  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleRead = (id: string) => {
    startTransition(async () => {
      await markNotificationReadAction(id);
      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_status: true } : n))
      );
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
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="relative h-8 w-8" title="Notifications" />
        }
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border/60">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle>Notifications</SheetTitle>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={pending}
                  onClick={handleReadAll}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Mark all read
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                render={<Link href="/notifications" onClick={() => setOpen(false)} />}
              >
                View all
                <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </div>
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No notifications yet.
            </p>
          )}
          {items.map((item) => (
            <NotificationItem key={item.id} item={item} onRead={handleRead} compact />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
