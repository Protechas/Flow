"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  getHelpLearnMoreHref,
  getHelpText,
  type HelpTextKey,
} from "@/lib/help/help-text";
import { cn } from "@/lib/utils";

export type InfoTooltipProps = {
  helpKey?: HelpTextKey;
  /** Raw text override — prefer helpKey for centralized copy */
  content?: string;
  learnMoreHref?: string;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
};

export function InfoTooltip({
  helpKey,
  content,
  learnMoreHref,
  side = "top",
  className,
}: InfoTooltipProps) {
  const text = content ?? (helpKey ? getHelpText(helpKey) : undefined);
  if (!text) return null;

  const docHref =
    learnMoreHref ?? (helpKey ? getHelpLearnMoreHref(helpKey) : undefined);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
              // Nearly invisible at rest — a dozen of these per screen reads
              // as clutter; they only need presence when sought out
              "text-muted-foreground opacity-30 hover:opacity-100 focus-visible:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              "cursor-help transition-opacity",
              className
            )}
            role="img"
            aria-label="More information"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          />
        }
      >
        <Info className="h-3 w-3" strokeWidth={2} aria-hidden />
      </TooltipTrigger>
      <TooltipContent
        side={side}
        className="max-w-[260px] border border-border/60 bg-popover px-3 py-2 text-left text-xs leading-relaxed text-popover-foreground shadow-md"
      >
        <p>{text}</p>
        {docHref && (
          <Link
            href={docHref}
            className="mt-2 block text-[10px] font-medium text-primary/90 underline-offset-2 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            Learn more
          </Link>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
