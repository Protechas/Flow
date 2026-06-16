"use client";

import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PackageDetailContent } from "@/components/operations/package-detail-content";
import type { Comment, TaskFileUpload, TimeLog, User, WorkPackage } from "@/types/flow";

interface PackageDetailSheetProps {
  pkg: WorkPackage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comments: Comment[];
  taskFiles: TaskFileUpload[];
  timeLogs: TimeLog[];
  currentUserId: string;
  analysts: User[];
  canAssign: boolean;
  canEdit: boolean;
  canSubmitQa?: boolean;
  canManage?: boolean;
}

export function PackageDetailSheet({
  pkg,
  open,
  onOpenChange,
  comments,
  taskFiles,
  timeLogs,
  currentUserId,
  analysts,
  canAssign,
  canEdit,
  canSubmitQa = false,
  canManage = false,
}: PackageDetailSheetProps) {
  const router = useRouter();
  if (!pkg) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto xl:hidden">
        <SheetHeader>
          <SheetTitle className="text-left pr-8">{pkg.title}</SheetTitle>
          <p className="text-sm text-muted-foreground">
            {pkg.manufacturer?.name} · {pkg.year}
          </p>
        </SheetHeader>
        <div className="mt-6">
          <PackageDetailContent
            pkg={pkg}
            comments={comments}
            taskFiles={taskFiles}
            timeLogs={timeLogs}
            currentUserId={currentUserId}
            analysts={analysts}
            actions={{ canAssign, canEdit, canSubmitQa, canManage }}
            onUpdated={() => router.refresh()}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
