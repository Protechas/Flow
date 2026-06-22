"use client";

import * as React from "react";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type WizardDialogSize = "md" | "lg" | "xl";

const SIZE_CLASS: Record<WizardDialogSize, string> = {
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-3xl",
};

/** Dialog shell for multi-step wizards — fixed header/footer, scrollable body. */
export function WizardDialogContent({
  className,
  size = "lg",
  children,
  ...props
}: React.ComponentProps<typeof DialogContent> & { size?: WizardDialogSize }) {
  return (
    <DialogContent
      className={cn(
        "flex w-full max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0",
        "max-h-[min(90vh,820px)]",
        SIZE_CLASS[size],
        className
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
}

export function WizardDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn("shrink-0 border-b border-border/40 px-6 py-4 pr-12", className)}
      {...props}
    />
  );
}

export function WizardDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col overflow-hidden px-6 py-4", className)}
      {...props}
    />
  );
}

/** Scrollable wizard step content — keeps actions visible below. */
export function WizardDialogScroll({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain",
        className
      )}
      {...props}
    />
  );
}

export function WizardDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn(
        "mx-0 mb-0 mt-0 shrink-0 rounded-none border-t border-border/40 bg-muted/15 px-6 py-4",
        className
      )}
      {...props}
    />
  );
}
