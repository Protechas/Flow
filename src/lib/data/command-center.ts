import {
  computeQaTurnaroundHours,
  generateCommandCenterInsights,
} from "@/lib/insights/command-center-insights";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getEmployeeScorecards, getTeamPerformanceDashboard } from "@/lib/data/performance";
import { getProjectHealthList } from "@/lib/data/project-health";
import { getWorkPackages } from "@/lib/data/work-packages";
import {
  computeQaPassRate,
  isOverdue,
  isStuck,
} from "@/lib/scoring/flow-score";
import type { CommandCenterMetrics, EmployeeRanking, EmployeeScorecard } from "@/types/flow";
import { isSameDay, parseISO, subDays } from "date-fns";

function trendDeltaFor(sc: EmployeeScorecard, rankings: EmployeeRanking[]): number {
  return rankings.find((r) => r.userId === sc.user.id)?.trendDelta ?? 0;
}

function buildAttentionList(
  scorecards: EmployeeScorecard[],
  rankings: EmployeeRanking[]
): CommandCenterMetrics["accountability"]["attentionList"] {
  const items: CommandCenterMetrics["accountability"]["attentionList"] = [];

  for (const sc of scorecards) {
    const trendDelta = trendDeltaFor(sc, rankings);
    if (sc.overdueItems >= 2 || sc.stuckItems > 0) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "coaching",
        reason:
          sc.stuckItems > 0
            ? `${sc.stuckItems} stuck · ${sc.overdueItems} overdue`
            : `${sc.overdueItems} overdue packages`,
        priority: sc.stuckItems > 0 ? 90 : 70 + sc.overdueItems,
        flowScore: sc.flowScore,
      });
    }
    if (trendDelta < -5) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "support",
        reason: `Flow Score declining (${trendDelta} trend)`,
        priority: 60 + Math.abs(trendDelta),
        flowScore: sc.flowScore,
      });
    }
    if (sc.metrics.correctionsReceived >= 3 && sc.qaPassRate < 80) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "coaching",
        reason: `${sc.metrics.correctionsReceived} QA corrections · ${sc.qaPassRate}% pass rate`,
        priority: 75,
        flowScore: sc.flowScore,
      });
    }
    if (sc.flowScore >= 85 && trendDelta >= 3) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "recognition",
        reason: `Top performer · +${trendDelta} trend · ${sc.flowScore} Flow Score`,
        priority: 100 - sc.flowScore,
        flowScore: sc.flowScore,
      });
    }
    if (sc.metrics.activeWork >= 8) {
      items.push({
        userId: sc.user.id,
        name: sc.user.full_name,
        category: "support",
        reason: `Overloaded with ${sc.metrics.activeWork} active packages`,
        priority: 80,
        flowScore: sc.flowScore,
      });
    }
  }

  const seen = new Set<string>();
  return items
    .sort((a, b) => b.priority - a.priority)
    .filter((item) => {
      const key = `${item.userId}-${item.category}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 12);
}

export async function getCommandCenterMetrics(): Promise<CommandCenterMetrics> {
  initFlowStore();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  const [performance, scorecards, projectHealthList] = await Promise.all([
    getTeamPerformanceDashboard(),
    getEmployeeScorecards(),
    getProjectHealthList(),
  ]);

  const acc = performance.accountabilityDashboard;
  const activePackages = packages.filter((p) => p.status !== "done");
  const avgActive =
    scorecards.length > 0
      ? Math.round(
          scorecards.reduce((s, c) => s + c.metrics.activeWork, 0) / scorecards.length
        )
      : 0;

  const workloadByEmployee = scorecards.map((sc) => {
    const mine = packages.filter((p) => p.assigned_to === sc.user.id);
    const active = mine.filter((p) => p.status !== "done").length;
    let flag: "overloaded" | "underutilized" | undefined;
    if (active >= avgActive + 3 || active >= 8) flag = "overloaded";
    else if (active <= Math.max(0, avgActive - 3) && active <= 2) flag = "underutilized";
    return {
      userId: sc.user.id,
      name: sc.user.full_name,
      active,
      inProgress: mine.filter((p) => p.status === "working_on_it").length,
      overdue: mine.filter(isOverdue).length,
      stuck: mine.filter(isStuck).length,
      hours: sc.hoursLogged,
      flag,
    };
  });

  const sortedWorkload = [...workloadByEmployee].sort((a, b) => b.active - a.active);
  const mostOverloaded = sortedWorkload[0]?.active > 0 ? sortedWorkload[0] : null;
  const lowestUtil = [...workloadByEmployee]
    .sort((a, b) => a.active - b.active || a.hours - b.hours)[0];

  const teamQuality = Math.round(
    scorecards.reduce((s, c) => s + c.qualityScore, 0) / (scorecards.length || 1)
  );
  const teamOnTime = performance.avgOnTimeRate;

  const rankings = performance.rankings;
  const topPerformer = rankings[0]
    ? { userId: rankings[0].userId, name: rankings[0].name, flowScore: rankings[0].flowScore }
    : null;
  const mostImprovedEntry = acc.mostImproved[0];
  const mostImproved = mostImprovedEntry
    ? {
        userId: mostImprovedEntry.userId,
        name: mostImprovedEntry.name,
        trendDelta: mostImprovedEntry.trendDelta,
        flowScore: mostImprovedEntry.flowScore,
      }
    : null;
  const needsAttention = acc.needsAttention[0]
    ? {
        userId: acc.needsAttention[0].userId,
        name: acc.needsAttention[0].name,
        reason: acc.needsAttention[0].reason,
        flowScore: acc.needsAttention[0].flowScore,
      }
    : null;

  const projects = projectHealthList
    .filter((ph) => ph.project.status !== "archived")
    .map((ph) => {
      let status: "at_risk" | "on_track" | "near_completion" = "on_track";
      if (ph.overdueCount >= 3 || ph.blockedCount >= 2) status = "at_risk";
      else if (ph.overallProgress >= 85) status = "near_completion";
      return {
        id: ph.project.id,
        name: ph.project.name,
        completedPct: ph.overallProgress,
        hoursLogged: ph.hoursLogged,
        qaRate: ph.rollup.qaPassRate,
        overdue: ph.overdueCount,
        estimatedCompletion: ph.projectedCompletion ?? null,
        status,
      };
    });

  const today = new Date();
  const weekStart = subDays(today, 7);
  const correctionsToday = store.corrections.filter((c) =>
    isSameDay(parseISO(c.created_at), today)
  ).length;
  const correctionsThisWeek = store.corrections.filter(
    (c) => parseISO(c.created_at) >= weekStart
  ).length;

  const qaQueue = packages.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status));
  const mfrBottlenecks = store.manufacturers
    .map((m) => ({
      label: m.name,
      count: qaQueue.filter((p) => p.manufacturer_id === m.id).length,
      href: "/qa-center",
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const decliningScores = scorecards
    .map((s) => ({ sc: s, trendDelta: trendDeltaFor(s, performance.rankings) }))
    .filter(({ trendDelta }) => trendDelta < -3)
    .map(({ sc, trendDelta }) => ({
      userId: sc.user.id,
      name: sc.user.full_name,
      trendDelta,
      flowScore: sc.flowScore,
    }))
    .sort((a, b) => a.trendDelta - b.trendDelta);

  const repeatedQaFailures = scorecards
    .filter((s) => s.metrics.correctionsReceived >= 2 && s.qaPassRate < 85)
    .map((s) => ({
      userId: s.user.id,
      name: s.user.full_name,
      corrections: s.metrics.correctionsReceived,
      qaPassRate: s.qaPassRate,
    }))
    .sort((a, b) => b.corrections - a.corrections);

  const insights = generateCommandCenterInsights({
    packages,
    projects: store.projects,
    manufacturers: store.manufacturers,
    qaReviews: store.qaReviews,
    activity: store.activity,
    scorecards,
    qaQueueSize: qaQueue.length,
    correctionsToday,
    correctionsThisWeek,
  });

  const n = scorecards.length || 1;

  return {
    teamHealth: {
      flowScore: acc.departmentAvgFlowScore,
      productivityScore: acc.teamProductivity,
      qualityScore: teamQuality,
      onTimeScore: teamOnTime,
      topPerformer,
      mostImproved,
      needsAttention,
      mostOverloaded: mostOverloaded
        ? {
            userId: mostOverloaded.userId,
            name: mostOverloaded.name,
            active: mostOverloaded.active,
            hours: mostOverloaded.hours,
          }
        : null,
      lowestUtilization: lowestUtil
        ? {
            userId: lowestUtil.userId,
            name: lowestUtil.name,
            active: lowestUtil.active,
            hours: lowestUtil.hours,
          }
        : null,
      scoreExplanations: {
        flow: {
          title: "Team Flow Score",
          value: acc.departmentAvgFlowScore,
          formula: "Average of employee Flow Scores (40% productivity + 30% quality + 20% on-time + 10% activity)",
          source: `${scorecards.length} active employees`,
          drilldownHref: "/performance",
          factors: scorecards.slice(0, 5).map((s) => ({
            label: s.user.full_name,
            value: s.flowScore,
          })),
        },
        productivity: {
          title: "Team Productivity Score",
          value: acc.teamProductivity,
          formula: "Average completions, hours logged, and velocity per employee (7-day window)",
          source: `${scorecards.reduce((s, c) => s + c.completedThisWeek, 0)} completions this week`,
          drilldownHref: "/performance",
        },
        quality: {
          title: "Team Quality Score",
          value: teamQuality,
          formula: "Average QA pass rate and correction penalty across employees",
          source: `${computeQaPassRate(store.qaReviews)}% QA pass rate on ${store.qaReviews.length} reviews`,
          drilldownHref: "/qa-center",
        },
        onTime: {
          title: "Team On-Time Score",
          value: teamOnTime,
          formula: "Average on-time completion rate across employee packages",
          source: `${packages.filter(isOverdue).length} packages currently overdue`,
          drilldownHref: "/operations",
        },
      },
    },
    workload: {
      active: activePackages.length,
      inProgress: packages.filter((p) => p.status === "working_on_it").length,
      readyForQa: packages.filter((p) => ["ready_for_qa", "in_qa"].includes(p.status)).length,
      correctionNeeded: packages.filter(
        (p) => p.status === "correction_needed" || ["minor_correction", "major_correction"].includes(p.qa_status)
      ).length,
      overdue: packages.filter(isOverdue).length,
      stuck: packages.filter(isStuck).length,
      avgActivePerEmployee: avgActive,
      byEmployee: workloadByEmployee,
    },
    projectHealth: {
      active: projects.length,
      atRisk: projects.filter((p) => p.status === "at_risk").length,
      onTrack: projects.filter((p) => p.status === "on_track").length,
      nearCompletion: projects.filter((p) => p.status === "near_completion").length,
      projects,
    },
    qaHealth: {
      queueSize: qaQueue.length,
      avgTurnaroundHours: computeQaTurnaroundHours(packages, store.activity, store.qaReviews),
      passRate: computeQaPassRate(store.qaReviews),
      correctionsToday,
      correctionsThisWeek,
      bottlenecks: mfrBottlenecks,
      highCorrectionAnalysts: acc.highestCorrectionRate,
    },
    accountability: {
      overdueEmployees: acc.mostOverdue,
      stuckEmployees: scorecards
        .filter((s) => s.stuckItems > 0)
        .map((s) => ({ userId: s.user.id, name: s.user.full_name, count: s.stuckItems }))
        .sort((a, b) => b.count - a.count),
      decliningScores,
      repeatedQaFailures,
      attentionList: buildAttentionList(scorecards, performance.rankings),
    },
    insights,
    trends30: acc.trends30,
  };
}
