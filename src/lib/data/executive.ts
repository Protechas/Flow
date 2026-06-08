import { getCommandCenterMetrics } from "@/lib/data/command-center";
import type { ExecutiveMetrics } from "@/types/flow";

/** @deprecated Use getCommandCenterMetrics — kept for backward compatibility */
export async function getExecutiveMetrics(): Promise<ExecutiveMetrics> {
  const cc = await getCommandCenterMetrics();
  return {
    teamFlowScore: cc.teamHealth.flowScore,
    teamProductivity: cc.teamHealth.productivityScore,
    teamQaRate: cc.teamHealth.qualityScore,
    activePackages: cc.workload.active,
    overduePackages: cc.workload.overdue,
    stuckPackages: cc.workload.stuck,
    readyForQa: cc.workload.readyForQa,
    completedToday: 0,
    completedThisWeek: 0,
    hoursLoggedToday: 0,
    qaPassRate: cc.qaHealth.passRate,
    projectHealth: cc.projectHealth.projects.map((p) => ({
      name: p.name,
      completedPct: p.completedPct,
      overdue: p.overdue,
      stuck: 0,
    })),
    topPerformer: cc.teamHealth.topPerformer,
    mostImproved: cc.teamHealth.mostImproved,
    mostAtRisk: cc.teamHealth.needsAttention,
    topPerformers: cc.accountability.attentionList
      .filter((a) => a.category === "recognition")
      .map((a) => ({ userId: a.userId, name: a.name, flowScore: a.flowScore })),
    needsAttention: cc.accountability.attentionList
      .filter((a) => a.category !== "recognition")
      .map((a) => ({ userId: a.userId, name: a.name, reason: a.reason })),
    workloadByAnalyst: cc.workload.byEmployee.map((e) => ({
      name: e.name,
      active: e.active,
      hours: e.hours,
    })),
    departmentTrends: cc.trends30,
  };
}
