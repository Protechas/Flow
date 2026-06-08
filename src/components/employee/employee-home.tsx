"use client";

import Link from "next/link";
import { startNextTaskAction } from "@/app/actions/employee";
import { EmployeeCurrentTask } from "@/components/employee/employee-current-task";
import { EmployeeDailySummaryBar } from "@/components/employee/employee-daily-summary";
import { EmployeeQaReturns } from "@/components/employee/employee-qa-returns";
import { EmployeeTaskSection } from "@/components/employee/employee-task-section";
import { EmployeeWorkQueue } from "@/components/employee/employee-work-queue";
import { EmployeeWrapUp } from "@/components/employee/employee-wrap-up";
import { FlowScoreRing } from "@/components/performance/flow-score-ring";
import { Button } from "@/components/ui/button";
import type { EmployeeDashboard } from "@/lib/employee/dashboard";
import { Calendar, Zap } from "lucide-react";

export function EmployeeHome({ dashboard, userName }: { dashboard: EmployeeDashboard; userName: string }) {
  const { nextTask, currentTask, dueToday, recentlyCompleted, dailySummary, scorecard, todayWrapUp, board } =
    dashboard;
  const hasWork = board.all.some((t) => t.status !== "done");

  return (
    <div className="space-y-6 sm:space-y-8 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
          Hi, {userName.split(" ")[0]}
        </h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Everything you need for today — in one place.
        </p>
      </div>

      <form action={startNextTaskAction}>
        <Button
          type="submit"
          size="lg"
          disabled={!nextTask}
          className="w-full h-12 text-base font-semibold"
        >
          <Zap className="h-6 w-6 mr-2" />
          Start Next Task
          {nextTask && (
            <span className="ml-2 text-sm font-normal opacity-90 hidden sm:inline truncate max-w-[200px]">
              — {nextTask.title}
            </span>
          )}
        </Button>
      </form>

      {!hasWork && (
        <p className="text-center text-sm text-muted-foreground py-4">
          No tasks assigned yet. Check back when your manager assigns work.
        </p>
      )}

      {scorecard && (
        <Link
          href="/scorecard"
          className="flow-card-interactive flex items-center gap-4 px-4 py-3 active:scale-[0.99]"
        >
          <FlowScoreRing score={scorecard.flowScore} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">My Flow Score</p>
            <p className="text-xs text-muted-foreground">
              {scorecard.completedThisWeek} done this week · Tap for your profile
            </p>
          </div>
          <span className="text-xs text-violet-400 shrink-0">→</span>
        </Link>
      )}

      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
          Daily summary
        </p>
        <EmployeeDailySummaryBar summary={dailySummary} />
      </div>

      {currentTask && <EmployeeCurrentTask task={currentTask} />}

      <EmployeeQaReturns returns={dashboard.qaReturns} />

      {dueToday.length > 0 && (
        <EmployeeTaskSection
          title="Due today"
          description="Finish these before end of day"
          tasks={dueToday}
          emptyLabel=""
          urgent
        />
      )}

      <EmployeeWorkQueue board={board} />

      {recentlyCompleted.length > 0 && (
        <EmployeeTaskSection
          title="Recently completed"
          description="Last few finishes"
          tasks={recentlyCompleted}
          emptyLabel=""
          collapsed
        />
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
        <Calendar className="h-3.5 w-3.5" />
        <span>End your day when you&apos;re done</span>
      </div>
      <EmployeeWrapUp existing={todayWrapUp} />
    </div>
  );
}
