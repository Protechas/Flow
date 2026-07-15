"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
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
import { Bell, BellRing, CheckCheck, ExternalLink } from "lucide-react";
import type { Notification as FlowNotification } from "@/types/flow";

/** How often the bell checks for news. Light query; background tabs clamp to ~1/min anyway. */
const POLL_MS = 60_000;
/** High-water mark so a notification only pops on the desktop once. */
const LAST_NOTIFIED_KEY = "flow-desktop-notified-at";

function desktopSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

/**
 * Fire OS notifications for fresh items. Hidden tab: everything pops.
 * Visible tab: team requests still pop — a waiting ticket shouldn't depend
 * on which window has focus; the bell badge covers the rest.
 */
const ALWAYS_POP_TYPES = new Set(["request_submitted", "request_update"]);

function notifyDesktop(allFresh: FlowNotification[]) {
  if (!desktopSupported() || window.Notification.permission !== "granted") return;
  const fresh = document.hidden
    ? allFresh
    : allFresh.filter((n) => ALWAYS_POP_TYPES.has(n.type));
  for (const n of fresh.slice(0, 3)) {
    try {
      const dn = new window.Notification(`Flow — ${n.title}`, {
        body: n.message,
        tag: n.id,
        icon: "/favicon.ico",
      });
      dn.onclick = () => {
        window.focus();
        window.location.href = n.link || "/notifications";
        dn.close();
      };
    } catch {
      // Some platforms restrict page-scope notifications — never break the app.
    }
  }
  if (fresh.length > 3) {
    try {
      new window.Notification("Flow", { body: `${fresh.length - 3} more notifications waiting` });
    } catch {
      /* same */
    }
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<FlowNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pending, startTransition] = useTransition();
  const initializedRef = useRef(false);

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const data = await getNotificationsAction({ limit: 20, status: "all" });

        // Desktop pops for anything newer than the high-water mark.
        const lastNotified = localStorage.getItem(LAST_NOTIFIED_KEY);
        if (!initializedRef.current) {
          initializedRef.current = true;
          // First load of a session: don't replay the backlog to the desktop.
          if (!lastNotified) localStorage.setItem(LAST_NOTIFIED_KEY, new Date().toISOString());
        } else if (lastNotified) {
          const fresh = data.items.filter(
            (n) => !n.read_status && n.created_at > lastNotified
          );
          if (fresh.length > 0) notifyDesktop(fresh);
        }
        const newest = data.items[0]?.created_at;
        if (newest && (!lastNotified || newest > lastNotified)) {
          localStorage.setItem(LAST_NOTIFIED_KEY, newest);
        }

        setItems(data.items);
        setUnread(data.unread);
      } catch {
        // Supabase busy — keep page alive; bell shows stale data until next poll.
      }
    });
  }, []);

  // Live badge + desktop alerts: poll on an interval, not just when opened.
  // First poll is delayed so page hydration never races a cold Supabase.
  useEffect(() => {
    setPermission(desktopSupported() ? window.Notification.permission : "unsupported");
    const first = setTimeout(refresh, 8_000);
    const interval = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
    };
  }, [refresh]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const enableDesktopAlerts = () => {
    if (!desktopSupported()) return;
    void window.Notification.requestPermission().then((result) => {
      setPermission(result);
      if (result === "granted") {
        try {
          new window.Notification("Flow", {
            body: "Desktop alerts are on — you'll see requests and updates even when Flow is minimized.",
          });
        } catch {
          /* fine */
        }
      }
    });
  };

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

        {permission === "default" && (
          <div className="mx-4 mt-3 rounded-md border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-start gap-2.5">
              <BellRing className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Get alerts when Flow is minimized</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  New requests and updates pop up on your desktop — no more checking back.
                </p>
                <Button size="sm" className="mt-2 h-7 text-xs" onClick={enableDesktopAlerts}>
                  Enable desktop alerts
                </Button>
              </div>
            </div>
          </div>
        )}
        {permission === "denied" && (
          <p className="mx-4 mt-3 text-xs text-muted-foreground">
            Desktop alerts are blocked for this site — enable notifications in your browser&apos;s
            site settings to get pops when Flow is minimized.
          </p>
        )}

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
