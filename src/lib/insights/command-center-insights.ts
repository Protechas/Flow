import { computeAvgCompletionHours, computeQaPassRate } from "@/lib/scoring/flow-score";
import type {
  ActivityEvent,
  CommandCenterInsight,
  EmployeeScorecard,
  Manufacturer,
  Project,
  QaReview,
  WorkPackage,
} from "@/types/flow";
import { differenceInHours, parseISO, subDays } from "date-fns";

interface InsightContext {
  packages: WorkPackage[];
  projects: Project[];
  manufacturers: Manufacturer[];
  qaReviews: QaReview[];
  activity: ActivityEvent[];
  scorecards: EmployeeScorecard[];
  qaQueueSize: number;
  correctionsToday: number;
  correctionsThisWeek: number;
}

export function generateCommandCenterInsights(ctx: InsightContext): CommandCenterInsight[] {
  const insights: CommandCenterInsight[] = [];
  let id = 0;
  const add = (insight: Omit<CommandCenterInsight, "id">) => {
    insights.push({ ...insight, id: `cci-${++id}` });
  };

  const mfrStats = ctx.manufacturers.map((m) => {
    const pkgs = ctx.packages.filter((p) => p.manufacturer_id === m.id);
    const done = pkgs.filter((p) => p.status === "done");
    return {
      name: m.name,
      avgHours: computeAvgCompletionHours(done.length ? done : pkgs),
      correctionRate:
        pkgs.length > 0
          ? Math.round(
              (pkgs.reduce((s, p) => s + p.correction_count, 0) / pkgs.length) * 100
            )
          : 0,
      overdue: pkgs.filter((p) => p.due_date && p.status !== "done" && parseISO(p.due_date) < new Date()).length,
      inQa: pkgs.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status)).length,
    };
  }).filter((m) => m.avgHours > 0 || m.correctionRate > 0);

  if (mfrStats.length >= 2) {
    const sorted = [...mfrStats].sort((a, b) => b.avgHours - a.avgHours);
    const fastest = sorted[sorted.length - 1];
    const slowest = sorted[0];
    if (slowest.avgHours > fastest.avgHours * 1.1) {
      const pct = Math.round(((slowest.avgHours - fastest.avgHours) / fastest.avgHours) * 100);
      add({
        priority: "medium",
        category: "productivity",
        text: `${slowest.name} packages are averaging ${pct}% longer to complete than ${fastest.name} packages.`,
        metric: `${slowest.avgHours}h vs ${fastest.avgHours}h avg`,
        drilldownHref: "/operations",
      });
    }

    const byCorr = [...mfrStats].sort((a, b) => b.correctionRate - a.correctionRate);
    if (byCorr[0].correctionRate > 0 && byCorr[0].correctionRate > (byCorr[1]?.correctionRate ?? 0)) {
      add({
        priority: "high",
        category: "quality",
        text: `${byCorr[0].name} work packages have the highest correction rate on the team.`,
        metric: `${byCorr[0].correctionRate}% avg corrections per package`,
        drilldownHref: "/operations",
      });
    }
  }

  for (const sc of ctx.scorecards) {
    if (sc.trend30.length >= 14) {
      const recent = sc.trend30.slice(-7).map((t) => t.qualityScore);
      const prior = sc.trend30.slice(-14, -7).map((t) => t.qualityScore);
      const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
      const priorAvg = prior.reduce((s, v) => s + v, 0) / prior.length;
      if (priorAvg > 0 && recentAvg > priorAvg + 5) {
        const delta = Math.round(recentAvg - priorAvg);
        add({
          priority: "low",
          category: "quality",
          text: `${sc.user.full_name} has improved QA quality by ${delta}% over the last 30 days.`,
          metric: `Quality score ${Math.round(recentAvg)}% (was ${Math.round(priorAvg)}%)`,
          drilldownHref: `/people/${sc.user.id}`,
        });
        break;
      }
    }
  }

  const weekAgo = subDays(new Date(), 7);
  const queueNow = ctx.qaQueueSize;
  const queueWeekAgo = ctx.packages.filter((p) => {
    const submitted = ctx.activity.find(
      (a) => a.work_package_id === p.id && a.type === "submit_qa" && parseISO(a.created_at) <= weekAgo
    );
    return submitted && ["ready_for_qa", "in_qa", "correction_needed"].includes(p.status);
  }).length;

  if (queueWeekAgo > 0 && queueNow > queueWeekAgo) {
    const pct = Math.round(((queueNow - queueWeekAgo) / queueWeekAgo) * 100);
    add({
      priority: queueNow >= 5 ? "high" : "medium",
      category: "qa",
      text: `QA queue has increased ${pct}% compared to last week.`,
      metric: `${queueNow} items waiting (was ~${queueWeekAgo})`,
      drilldownHref: "/qa-center",
    });
  } else if (queueNow >= 5) {
    add({
      priority: "high",
      category: "qa",
      text: `QA queue has ${queueNow} items awaiting review — above team threshold.`,
      metric: `${queueNow} in queue`,
      drilldownHref: "/qa-center",
    });
  }

  const projectStats = ctx.projects.map((proj) => {
    const pkgs = ctx.packages.filter((p) => p.project_id === proj.id);
    const overdue = pkgs.filter((p) => p.due_date && p.status !== "done" && parseISO(p.due_date) < new Date()).length;
    return { name: proj.name, overdue, total: pkgs.length };
  }).filter((p) => p.overdue > 0);

  if (projectStats.length) {
    const worst = [...projectStats].sort((a, b) => b.overdue - a.overdue)[0];
    add({
      priority: "high",
      category: "project",
      text: `${worst.name} has the most overdue work packages right now.`,
      metric: `${worst.overdue} overdue of ${worst.total} total`,
      drilldownHref: "/project-health",
    });
  }

  const overloaded = ctx.scorecards.filter((s) => s.metrics.activeWork >= 8);
  if (overloaded.length) {
    add({
      priority: "medium",
      category: "workload",
      text: `${overloaded[0].user.full_name} is carrying ${overloaded[0].metrics.activeWork} active packages — highest on the team.`,
      metric: `${overloaded[0].metrics.activeWork} active tasks`,
      drilldownHref: `/people/${overloaded[0].user.id}`,
    });
  }

  if (ctx.correctionsThisWeek > ctx.correctionsToday * 2 && ctx.correctionsThisWeek >= 3) {
    add({
      priority: "medium",
      category: "quality",
      text: `${ctx.correctionsThisWeek} corrections were issued this week — review quality trends with the team.`,
      metric: `${ctx.correctionsToday} today · ${ctx.correctionsThisWeek} this week`,
      drilldownHref: "/reports",
    });
  }

  const passRate = computeQaPassRate(ctx.qaReviews);
  if (passRate < 85 && ctx.qaReviews.length >= 3) {
    add({
      priority: "high",
      category: "quality",
      text: `Team QA pass rate is ${passRate}% — below the 85% target.`,
      metric: `${ctx.qaReviews.filter((r) => r.result === "pass").length}/${ctx.qaReviews.length} reviews passed`,
      drilldownHref: "/qa-center",
    });
  }

  return insights
    .sort((a, b) => {
      const p = { high: 0, medium: 1, low: 2 };
      return p[a.priority] - p[b.priority];
    })
    .slice(0, 8);
}

export function computeQaTurnaroundHours(
  packages: WorkPackage[],
  activity: ActivityEvent[],
  reviews: QaReview[]
): number {
  const deltas: number[] = [];
  for (const review of reviews) {
    const submit = activity
      .filter(
        (a) =>
          a.work_package_id === review.work_package_id &&
          a.type === "submit_qa" &&
          parseISO(a.created_at) <= parseISO(review.reviewed_at)
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (submit) {
      deltas.push(
        differenceInHours(parseISO(review.reviewed_at), parseISO(submit.created_at))
      );
    }
  }
  if (!deltas.length) return 0;
  return Math.round((deltas.reduce((s, d) => s + d, 0) / deltas.length) * 10) / 10;
}
