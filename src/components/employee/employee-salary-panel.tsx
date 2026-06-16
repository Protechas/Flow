import { Briefcase } from "lucide-react";

export function EmployeeSalaryPanel({
  taskMinutesToday,
  activeTaskTitle,
}: {
  taskMinutesToday: number;
  activeTaskTitle?: string | null;
}) {
  const hours = Math.floor(taskMinutesToday / 60);
  const mins = taskMinutesToday % 60;
  const timeLabel = hours > 0 ? `${hours}h ${mins}m` : mins > 0 ? `${mins}m` : "—";

  return (
    <div className="enterprise-panel p-4 sm:p-5 border-primary/20">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Briefcase className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="enterprise-label">Salary employee</p>
          <p className="text-sm font-semibold mt-0.5">Task-based tracking</p>
          <p className="flow-helper mt-1">
            No shift clock required. Start tasks, log work time, and submit completed files for QA.
          </p>
          {activeTaskTitle && (
            <p className="text-xs text-primary mt-2 truncate">
              Active: {activeTaskTitle}
            </p>
          )}
          <p className="flow-meta mt-2">Task time today: {timeLabel}</p>
        </div>
      </div>
    </div>
  );
}
