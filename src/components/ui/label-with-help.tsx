"use client";

import { Label } from "@/components/ui/label";
import { InfoTooltip, type InfoTooltipProps } from "@/components/ui/info-tooltip";
import { cn } from "@/lib/utils";

export function LabelWithHelp({
  htmlFor,
  children,
  helpKey,
  content,
  className,
  labelClassName,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  helpKey?: InfoTooltipProps["helpKey"];
  content?: string;
  className?: string;
  labelClassName?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Label htmlFor={htmlFor} className={labelClassName}>
        {children}
      </Label>
      <InfoTooltip helpKey={helpKey} content={content} />
    </div>
  );
}
