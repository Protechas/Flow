import { ClockStatusBadge } from "@/components/enterprise/clock-status-badge";
import { WrapUpStatusBadge } from "@/components/enterprise/wrap-up-status-badge";
import { PayTypeBadge } from "@/components/enterprise/pay-type-badge";
import { EnterpriseKpi } from "@/components/enterprise/enterprise-kpi";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import {
  EnterpriseDataTable,
  EnterpriseTableHead,
  EnterpriseTd,
  EnterpriseTh,
} from "@/components/enterprise/enterprise-data-table";
import { formatMinutes } from "@/lib/production/metrics";
import {
  summarizeTeamAvailability,
  type TeamMemberAvailability,
} from "@/lib/time-clock/availability-types";

function AvailabilityStatus({ member }: { member: TeamMemberAvailability }) {
  if (member.status === "exempt") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
        Available
      </span>
    );
  }
  return <ClockStatusBadge status={member.status} />;
}

export function TeamAvailabilityPanel({
  members,
}: {
  members: TeamMemberAvailability[];
}) {
  if (members.length === 0) return null;

  const summary = summarizeTeamAvailability(members);

  return (
    <EnterpriseSection
      title="Team availability"
      description="Hourly staff use shift clock; salary staff track time via active tasks"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
        <EnterpriseKpi label="Clocked in" value={summary.onShift} />
        <EnterpriseKpi label="On lunch" value={summary.onLunch} warn={summary.onLunch > 0} />
        <EnterpriseKpi label="On task (salary)" value={summary.onTask} />
        <EnterpriseKpi label="Off shift" value={summary.offShift} />
        <EnterpriseKpi
          label="Team time today"
          value={summary.totalHoursLabel}
          sublabel={`${summary.hourlyCount} hourly · ${summary.salaryCount} salary`}
        />
      </div>

      <EnterpriseDataTable compact>
        <EnterpriseTableHead>
          <tr>
            <EnterpriseTh>Employee</EnterpriseTh>
            <EnterpriseTh>Pay</EnterpriseTh>
            <EnterpriseTh>Status</EnterpriseTh>
            <EnterpriseTh>Wrap-up</EnterpriseTh>
            <EnterpriseTh>Since</EnterpriseTh>
            <EnterpriseTh align="right">Time today</EnterpriseTh>
            <EnterpriseTh>Activity</EnterpriseTh>
          </tr>
        </EnterpriseTableHead>
        <tbody>
          {members.map((member) => (
            <tr key={member.userId} className="enterprise-row-hover">
              <EnterpriseTd className="font-medium">{member.name}</EnterpriseTd>
              <EnterpriseTd>
                <PayTypeBadge payType={member.payType} />
              </EnterpriseTd>
              <EnterpriseTd>
                <AvailabilityStatus member={member} />
              </EnterpriseTd>
              <EnterpriseTd>
                {member.requiresShiftClock && member.wrapUpStatus ? (
                  <WrapUpStatusBadge status={member.wrapUpStatus} />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </EnterpriseTd>
              <EnterpriseTd className="text-muted-foreground">
                {member.since ?? "—"}
              </EnterpriseTd>
              <EnterpriseTd align="right" className="tabular-nums">
                {member.requiresShiftClock
                  ? member.shiftMinutesToday > 0
                    ? formatMinutes(member.shiftMinutesToday)
                    : "—"
                  : member.taskMinutesToday > 0
                    ? formatMinutes(member.taskMinutesToday)
                    : "—"}
              </EnterpriseTd>
              <EnterpriseTd className="text-muted-foreground text-xs max-w-[180px] truncate">
                {member.activeTaskTitle ??
                  (member.lastPunchAt
                    ? new Date(member.lastPunchAt).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : "—")}
              </EnterpriseTd>
            </tr>
          ))}
        </tbody>
      </EnterpriseDataTable>
    </EnterpriseSection>
  );
}
