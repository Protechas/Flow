import { appTodayDate } from "@/lib/datetime/timezone";
import { EmployeeHome } from "@/components/employee/employee-home";
import { EmployeeNeedsSetupView } from "@/components/setup/employee-needs-setup-view";
import { LiveRefresh } from "@/components/platform";
import { requirePageAccess } from "@/lib/auth/guard";
import { loadAccountSetupSummary } from "@/lib/setup/guard";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { getEmployeeDashboard } from "@/lib/employee/dashboard";
import {
  getActiveClockEntry,
  getActiveSideSession,
  getSideSessionMinutesToday,
  getTaskMinutesToday,
  getTodayClockEntries,
} from "@/lib/data/production-tracking";
import { normalizePayType } from "@/lib/users/pay-type";
import { getWrapUpComplianceStatus } from "@/lib/wrap-up/compliance";
import { getWorkEligibility, syncWorkEligibilityMismatchAlert } from "@/lib/work-eligibility";
import { hydrateHelpFlagSettings } from "@/lib/help-flags/hydrate";
import { listEmployeeHelpFlags } from "@/lib/help-flags/engine";
import { getFlowStore } from "@/lib/data/flow-store";
import { getWorkPackages } from "@/lib/data/work-packages";
import { initProductionTracking } from "@/lib/data/production-tracking";
import { getTodayVisibilityForUser } from "@/lib/work-visibility/calculator";
import { employeeHasOpenWorkloadRequest } from "@/lib/workload-alerts/employee-requests";
import { CoachPanel } from "@/components/coach/coach-panel";
import { computeCoachNudges, resolveCoachPersona } from "@/lib/coach/nudges";
import { BadgesPanel } from "@/components/badges/badges-panel";
import { computeBadges } from "@/lib/badges/badges";
import Link from "next/link";
import { RequestQueue } from "@/components/requests/request-queue";
import { isTicketReceiver } from "@/lib/requests/audience";
import { listActiveTickets } from "@/lib/requests/tickets";
import { listFilesForTickets } from "@/lib/requests/ticket-files";
import { hydrateOperatingModels } from "@/lib/operating-models/hydrate";
import { resolveOperatingModelForTeam } from "@/lib/operating-models/resolve";

export default async function EmployeeWorkPage() {
  const user = await requirePageAccess("/work");
  const dashboard = await getEmployeeDashboard(user.id);
  const payType = normalizePayType(user.pay_type, user.role);
  const today = appTodayDate();
  await hydrateHelpFlagSettings();
  initProductionTracking();
  const store = getFlowStore();
  const packages = await getWorkPackages();
  const helpFlags = listEmployeeHelpFlags(user.id, packages, store.users);
  syncWorkEligibilityMismatchAlert(user);

  const activeClock = getActiveClockEntry(user.id);

  const setup = loadAccountSetupSummary(user);
  if (isEmployeeRole(user.role) && setup.setupStatus === "needs_setup") {
    return <EmployeeNeedsSetupView user={user} setup={setup} />;
  }

  const coachNudges = computeCoachNudges(user);
  const badges = await computeBadges(user.id);

  // Per-team workspace behavior (extra wrap-up prompts, home panels) comes
  // from the team's operating model — the engine that makes each team's
  // workspace feel purpose-built without team-specific code.
  await hydrateOperatingModels();
  const teamModel = resolveOperatingModelForTeam(user.team_id);
  const teamWorkspace = {
    wrapUpFields: teamModel.wrapUpFields ?? [],
    showActiveProjectsPanel: teamModel.workspace?.showActiveProjectsPanel === true,
    overdueFirst: teamModel.workspace?.overdueFirst === true,
  };
  const activeTickets = await listActiveTickets().catch(() => []);
  // Open tickets are claimable only by the receiving departments; anything
  // you already claimed always shows so it can be finished.
  const canReceiveTickets = await isTicketReceiver(user);
  const myVisibleTickets = activeTickets.filter(
    (t) => (canReceiveTickets && t.status === "open") || t.claimed_by === user.id
  );
  const ticketFiles = await listFilesForTickets(myVisibleTickets.map((t) => t.id)).catch(
    () => ({})
  );
  // Header pulse: receivers always see the box, even at zero — visibility
  // builds the habit of checking. Count = unclaimed requests only.
  const openTickets = canReceiveTickets
    ? activeTickets.filter((t) => t.status === "open")
    : [];
  const ticketPulse = canReceiveTickets
    ? {
        open: openTickets.length,
        oldestMinutes: openTickets.length
          ? Math.max(
              0,
              Math.round(
                (Date.now() -
                  Math.min(...openTickets.map((t) => new Date(t.created_at).getTime()))) /
                  60000
              )
            )
          : null,
      }
    : null;

  return (
    <>
      <LiveRefresh intervalMs={activeClock ? 30_000 : 60_000} />
      <div className="mb-4">
        <CoachPanel nudges={coachNudges} persona={resolveCoachPersona(user)} />
      </div>
      {myVisibleTickets.length > 0 && (
        <div className="enterprise-panel p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">
              Team requests waiting
            </p>
            <Link href="/work/requests" className="text-xs text-primary hover:underline" prefetch={false}>
              All requests
            </Link>
          </div>
          <RequestQueue tickets={myVisibleTickets} currentUserId={user.id} filesByTicket={ticketFiles} />
        </div>
      )}
      <EmployeeHome
        dashboard={dashboard}
        userName={user.full_name}
        payType={payType}
        activeClock={activeClock}
      todayClockEntries={getTodayClockEntries(user.id)}
      taskMinutesToday={getTaskMinutesToday(user.id)}
      wrapUpStatus={getWrapUpComplianceStatus(user.id, today)}
      helpFlags={helpFlags}
      workEligibility={getWorkEligibility(user)}
      visibilityToday={getTodayVisibilityForUser(user.id)}
      pendingWorkRequest={employeeHasOpenWorkloadRequest(user.id)}
      sideSession={getActiveSideSession(user.id)}
      sideSessionMinutes={getSideSessionMinutesToday(user.id)}
      ticketPulse={ticketPulse}
      teamWorkspace={teamWorkspace}
    />
      <div className="mt-4">
        <BadgesPanel
          badges={badges}
          cosmetics={{
            frame: user.avatar_frame ?? null,
            title: user.flair_title ?? null,
            accent: user.accent_color ?? null,
          }}
        />
      </div>
    </>
  );
}
