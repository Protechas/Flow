"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

const DISMISS_KEY = "flow-critical-alert-popup-dismissed";

/**
 * Loud, once-per-session popup for open critical (red) alerts in the
 * viewer's branch. Dismissing it keeps it quiet until the next session or
 * until the set of critical alerts changes.
 */
export function CriticalAlertPopup({
  count,
  headlines,
}: {
  count: number;
  headlines: string[];
}) {
  const [open, setOpen] = useState(false);
  const signature = `${count}:${headlines.join("|")}`;

  useEffect(() => {
    if (count < 1) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === signature) return;
    } catch {
      // storage unavailable — still show the popup
    }
    setOpen(true);
  }, [count, signature]);

  if (count < 1) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, signature);
    } catch {
      // ignore
    }
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md border-destructive/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {count === 1 ? "Critical alert" : `${count} critical alerts`}
          </DialogTitle>
          <DialogDescription>
            {count === 1
              ? "A critical alert in your branch needs immediate attention."
              : "Critical alerts in your branch need immediate attention."}
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-1 text-sm">
          {headlines.slice(0, 4).map((h, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
              {h}
            </li>
          ))}
          {headlines.length > 4 && (
            <li className="text-muted-foreground">…and {headlines.length - 4} more</li>
          )}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={dismiss}>
            Dismiss for now
          </Button>
          <Button
            variant="destructive"
            render={<Link href="/alert-center" onClick={dismiss} />}
          >
            Open Alert Center
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
