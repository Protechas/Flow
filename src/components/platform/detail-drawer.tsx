"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function DetailDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  side = "right",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  side?: "right" | "left";
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn(
          "flow-platform-detail-drawer flow-glass-drawer w-full sm:max-w-md overflow-y-auto",
          side === "right" && "rounded-l-[var(--flow-radius-drawer)]",
          side === "left" && "rounded-r-[var(--flow-radius-drawer)]",
          className
        )}
      >
        <SheetHeader className="border-b border-border/40 pb-4">
          <SheetTitle className="pr-8 text-base font-semibold tracking-tight">{title}</SheetTitle>
          {description && <SheetDescription className="text-sm">{description}</SheetDescription>}
        </SheetHeader>
        <div className="flow-platform-detail-body mt-5 space-y-4 px-1">{children}</div>
        {footer && (
          <div className="flow-platform-detail-footer mt-6 pt-4 border-t border-border/40">
            {footer}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
