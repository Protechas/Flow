"use client";

import { useTransition } from "react";
import { exitEmployeePreviewAction } from "@/app/actions/employee-preview";
import { Button } from "@/components/ui/button";
import { Eye, X } from "lucide-react";

/** Shown to leads/managers while they're inside the employee shell. */
export function EmployeePreviewBanner() {
  const [pending, startTransition] = useTransition();
  return (
    <div className="sticky top-0 z-50 flex items-center justify-center gap-3 border-b border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs backdrop-blur">
      <Eye className="h-3.5 w-3.5 text-amber-500" />
      <span>
        <span className="font-semibold text-amber-500">Employee preview</span> — you&apos;re
        seeing Flow the way your team sees it.
      </span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 border-amber-500/40 text-xs"
        disabled={pending}
        onClick={() => startTransition(() => exitEmployeePreviewAction())}
      >
        <X className="h-3 w-3" />
        Exit preview
      </Button>
    </div>
  );
}
