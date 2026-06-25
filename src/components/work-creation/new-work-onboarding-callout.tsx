"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  dismissNewWorkOnboarding,
  isNewWorkOnboardingDismissed,
} from "@/lib/work-creation/new-work-onboarding";
import { Kanban, ListTodo, Sparkles, X } from "lucide-react";

function useAnchorPosition(
  anchorRef: RefObject<HTMLElement | null>,
  enabled: boolean
) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !anchorRef.current) {
      setStyle(null);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(320, window.innerWidth - 32);
      const left = Math.min(
        Math.max(16, rect.right - width),
        window.innerWidth - width - 16
      );

      setStyle({
        position: "fixed",
        top: rect.bottom + 10,
        left,
        width,
        zIndex: 200,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, enabled]);

  return style;
}

export function NewWorkOnboardingCallout({
  anchorRef,
  userId,
  onDismiss,
  onOpenHub,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  userId: string;
  onDismiss?: () => void;
  /** Called when user opens the hub — auto-dismisses the tip. */
  onOpenHub?: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setVisible(!isNewWorkOnboardingDismissed(userId));
  }, [userId]);

  const positionStyle = useAnchorPosition(anchorRef, visible && mounted);

  function dismiss() {
    dismissNewWorkOnboarding(userId);
    setVisible(false);
    onDismiss?.();
  }

  if (!visible || !mounted || !positionStyle) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      style={positionStyle}
      className="relative rounded-lg border border-primary/30 bg-popover text-popover-foreground shadow-xl p-3 space-y-2.5 animate-in fade-in-0 zoom-in-95"
      data-testid="new-work-onboarding-callout"
    >
      {/* Caret aligned toward anchor (top-right of card) */}
      <div
        aria-hidden
        className="absolute -top-1.5 right-6 h-3 w-3 rotate-45 border border-primary/30 border-b-0 border-r-0 bg-popover"
      />
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          New work hub
        </div>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground rounded p-0.5"
          aria-label="Dismiss tip"
          onClick={dismiss}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Start here to build a team board or add a tracked task. Boards set QA and file defaults;
        tasks inherit them automatically.
      </p>
      <ul className="text-xs space-y-1 text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <Kanban className="h-3 w-3 text-primary shrink-0" />
          <span>
            <strong className="text-foreground font-medium">New board</strong> — team queue with
            tracking
          </span>
        </li>
        <li className="flex items-center gap-1.5">
          <ListTodo className="h-3 w-3 text-primary shrink-0" />
          <span>
            <strong className="text-foreground font-medium">New task</strong> — add work to a board
            or program
          </span>
        </li>
      </ul>
      <div className="flex gap-2 pt-0.5">
        <Button
          type="button"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            dismiss();
            onOpenHub?.();
          }}
        >
          Try it
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={dismiss}>
          Got it
        </Button>
      </div>
    </div>,
    document.body
  );
}
