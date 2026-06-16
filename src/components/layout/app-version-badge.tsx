"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAppVersionInfo } from "@/lib/app/version";
import { cn } from "@/lib/utils";

function environmentLabel(env: string): string {
  switch (env) {
    case "production":
      return "Production";
    case "preview":
      return "Preview";
    case "development":
      return "Development";
    default:
      return env.charAt(0).toUpperCase() + env.slice(1);
  }
}

export function AppVersionBadge({ className }: { className?: string }) {
  const info = useMemo(() => getAppVersionInfo(), []);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "w-full text-left px-1 py-1.5 rounded-sm",
          "text-[10px] leading-tight text-muted-foreground/70",
          "hover:text-muted-foreground transition-colors",
          "group-data-[collapsible=icon]:hidden",
          className
        )}
        aria-label={`About ${info.name} ${info.version}`}
        title="About Flow"
      >
        <span className="block truncate">{info.versionLabel}</span>
        <span className="block truncate opacity-80">{info.buildLabel}</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{info.name}</DialogTitle>
            <DialogDescription>Enterprise operations platform</DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Version</dt>
            <dd className="font-medium tabular-nums">v{info.version}</dd>
            <dt className="text-muted-foreground">Build</dt>
            <dd className="font-medium tabular-nums">{info.buildDate}</dd>
            <dt className="text-muted-foreground">Environment</dt>
            <dd className="font-medium">{environmentLabel(info.environment)}</dd>
            {info.deploymentSource ? (
              <>
                <dt className="text-muted-foreground">Source</dt>
                <dd className="font-medium truncate">{info.deploymentSource}</dd>
              </>
            ) : null}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  );
}
