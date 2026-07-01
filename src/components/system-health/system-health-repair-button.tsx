"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { runSystemHealthRepairAction } from "@/app/actions/system-health-repair";
import type { SystemHealthRepairKey } from "@/lib/system-health/repair-plans";
import { Button } from "@/components/ui/button";

const REPAIR_LABELS: Record<SystemHealthRepairKey, string> = {
  "clear-missing-org-parents": "Clear broken parent links",
  "clear-invalid-task-assignees": "Unassign invalid assignees",
  "clear-invalid-manager-links": "Clear invalid manager links",
};

export function SystemHealthRepairButton({
  repairKey,
  count,
}: {
  repairKey: SystemHealthRepairKey;
  count: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || count <= 0}
        onClick={() => {
          setMessage(null);
          startTransition(async () => {
            try {
              const result = await runSystemHealthRepairAction(repairKey);
              setMessage(`Repaired ${result.repaired} record(s).`);
              router.refresh();
            } catch (e) {
              setMessage(e instanceof Error ? e.message : "Repair failed");
            }
          });
        }}
      >
        {pending ? "Repairing…" : REPAIR_LABELS[repairKey]}
      </Button>
      {message && <span className="text-xs text-muted-foreground">{message}</span>}
    </div>
  );
}
