import { parseBoardTaskDefaults } from "@/lib/work-creation/board-defaults";
import type { Project } from "@/types/flow";
import { cn } from "@/lib/utils";

export function BoardTrackingBadges({
  project,
  className,
}: {
  project: Project;
  className?: string;
}) {
  if (project.project_type !== "board" && project.project_type !== "research") return null;
  const defaults = parseBoardTaskDefaults(project);
  if (!defaults) return null;

  return (
    <span className={cn("inline-flex flex-wrap gap-1", className)}>
      {defaults.qaRequired && (
        <span className="text-[10px] font-medium rounded-sm border border-sky-500/30 bg-sky-500/10 text-sky-300 px-1.5 py-0.5">
          QA on
        </span>
      )}
      {defaults.filesRequired && (
        <span className="text-[10px] font-medium rounded-sm border border-violet-500/30 bg-violet-500/10 text-violet-300 px-1.5 py-0.5">
          Files on
        </span>
      )}
    </span>
  );
}
