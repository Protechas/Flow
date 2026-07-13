import {
  FlowPageShell,
  KpiStrip,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { CoachingList } from "@/components/coaching/coaching-list";
import { LogCoachingDialog } from "@/components/coaching/log-coaching-dialog";
import { requirePageAccess } from "@/lib/auth/guard";
import { getScopeMemberIds } from "@/lib/auth/team-scope";
import { getFlowStore, listTeamsStore } from "@/lib/data/flow-store";
import { listCoachingSessions } from "@/lib/coaching/sessions";
import { appTodayDate } from "@/lib/datetime/timezone";
import { isProductionEmployee } from "@/lib/users/production-roster";

export default async function CoachingPage() {
  const user = await requirePageAccess("/coaching");
  const store = getFlowStore();

  // Same scope as the rest of the app: leads see their branch, admins see all.
  const branchIds = getScopeMemberIds(user, store.users, listTeamsStore());
  let sessions = await listCoachingSessions();
  if (branchIds?.length) {
    const branch = new Set(branchIds);
    sessions = sessions.filter((s) => branch.has(s.employee_id) || s.coach_id === user.id);
  }

  const today = appTodayDate();
  const open = sessions.filter((s) => s.status === "open");
  const awaitingAck = sessions.filter((s) => !s.acknowledged_at && s.status === "open");
  const followUpsDue = open.filter((s) => s.follow_up_date && s.follow_up_date <= today);

  const coachableEmployees = store.users
    .filter((u) => u.is_active && u.id !== user.id && isProductionEmployee(u))
    .filter((u) => !branchIds?.length || branchIds.includes(u.id))
    .map((u) => ({ id: u.id, name: u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FlowPageShell
      title="Coaching"
      eyebrow={PLATFORM_EYEBROWS.people}
      breadcrumbs={[{ label: "Coaching" }]}
      description="Accountability records for coaching conversations — what was discussed, what was agreed, and whether it stuck"
      headerActions={<LogCoachingDialog employees={coachableEmployees} />}
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "total", label: "Sessions on record", value: sessions.length },
            { id: "open", label: "Open", value: open.length },
            {
              id: "ack",
              label: "Awaiting acknowledgment",
              value: awaitingAck.length,
              warn: awaitingAck.length > 0,
            },
            {
              id: "followup",
              label: "Follow-ups due",
              value: followUpsDue.length,
              warn: followUpsDue.length > 0,
            },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="p-4 sm:p-5">
          <CoachingList sessions={sessions} viewerId={user.id} canManage />
        </WorkspaceContainer>
      }
    />
  );
}
