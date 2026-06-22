"use client";

import { Suspense, useState } from "react";
import { InnovationHubPanel } from "@/components/innovation-hub/innovation-hub-panel";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Lightbulb } from "lucide-react";

export function InnovationHubBubble() {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon"
              aria-label="Innovation Hub"
              onClick={() => setOpen(true)}
              className={cn(
                "fixed z-40 h-11 w-11 rounded-full shadow-lg",
                "border border-border/60 bg-card text-primary",
                "hover:bg-primary/10 hover:border-primary/30",
                "bottom-20 right-4 sm:bottom-6 sm:right-6"
              )}
            />
          }
        >
          <Lightbulb className="h-5 w-5" />
        </TooltipTrigger>
        <TooltipContent side="left">Innovation Hub</TooltipContent>
      </Tooltip>

      <Suspense fallback={null}>
        <InnovationHubPanel open={open} onOpenChange={setOpen} />
      </Suspense>
    </TooltipProvider>
  );
}
