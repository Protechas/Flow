"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Notification, NotificationType } from "@/types/flow";
import { formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ClipboardCheck,
  FileUp,
  MessageSquare,
  UserPlus,
} from "lucide-react";

const TYPE_ICONS: Partial<Record<NotificationType, typeof Bell>> = {
  new_assignment: UserPlus,
  task_due_soon: AlertTriangle,
  task_overdue: AlertTriangle,
  qa_review_needed: ClipboardCheck,
  qa_passed: ClipboardCheck,
  correction_issued: AlertTriangle,
  correction_resolved: CheckCheck,
  comment_mention: MessageSquare,
  file_uploaded: FileUp,
  project_at_risk: AlertTriangle,
  employee_overloaded: AlertTriangle,
  work_stuck: AlertTriangle,
};

function NotificationRow({
  item,
  onRead,
}: {
  item: Notification;
  onRead: (id: string) => void;
}) {
  const Icon = TYPE_ICONS[item.type] ?? Bell;
  const content = (
    <div
      className={cn(
        "flex gap-3 p-3 rounded-lg transition-colors",
        !item.read_status && "bg-violet-500/10",
        item.link && "hover:bg-muted/50 cursor-pointer"
      )}
      onClick={() => !item.read_status && onRead(item.id)}
    >
      <div className="mt-0.5 shrink-0">
        <Icon className="h-4 w-4 text-violet-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{item.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.message}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(parseISO(item.created_at), { addSuffix: true })}
        </p>
      </div>
      {!item.read_status && (
        <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
      )}
    </div>
  );

  if (item.link) {
    return (
      <Link href={item.link} onClick={() => onRead(item.id)}>
        {content}
      </Link>
    );
  }
  return content;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const data = await getNotificationsAction();
      setItems(data.items);
      setUnread(data.unread);
    });
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60_000);
    return () => clearInterval(interval);
  }, [refresh]);

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
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-violet-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <SheetTitle>Notifications</SheetTitle>
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
          </div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              No notifications yet.
            </p>
          )}
          {items.map((item) => (
            <NotificationRow key={item.id} item={item} onRead={handleRead} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
