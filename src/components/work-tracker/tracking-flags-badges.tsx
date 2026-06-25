import { Badge } from "@/components/ui/badge";
import { resolveWorkPackageTrackingFlags } from "@/lib/work-packages/tracking-flags";
import type { WorkPackage } from "@/types/flow";

export function TrackingFlagsBadges({
  pkg,
  className,
}: {
  pkg: Pick<WorkPackage, "qa_required" | "files_required" | "notes">;
  className?: string;
}) {
  const { qaRequired, filesRequired } = resolveWorkPackageTrackingFlags(pkg);
  if (!qaRequired && !filesRequired) return null;

  return (
    <div className={`flex flex-wrap gap-1 ${className ?? ""}`}>
      {qaRequired && (
        <Badge variant="outline" className="text-[10px] h-5">
          QA
        </Badge>
      )}
      {filesRequired && (
        <Badge variant="outline" className="text-[10px] h-5">
          Files
        </Badge>
      )}
    </div>
  );
}
