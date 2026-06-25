"use client";

import { useState } from "react";
import { AssignTaskDialog } from "@/components/work-creation/assign-task-dialog";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import type { User, WorkPackage } from "@/types/flow";

export function AssignTaskTrigger({
  analysts,
  workPackages,
}: {
  analysts: User[];
  workPackages: WorkPackage[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" className="h-8" onClick={() => setOpen(true)}>
        <UserPlus className="h-3.5 w-3.5 mr-1.5" />
        Assign existing
      </Button>
      <AssignTaskDialog
        open={open}
        onOpenChange={setOpen}
        analysts={analysts}
        workPackages={workPackages}
      />
    </>
  );
}
