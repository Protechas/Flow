import {
  FlowPageShell,
  KpiStrip,
  LiveRefresh,
  PLATFORM_EYEBROWS,
  WorkspaceContainer,
} from "@/components/platform";
import { Badge } from "@/components/ui/badge";
import { MyRequestsList } from "@/components/requests/my-requests-list";
import { RequestForm } from "@/components/requests/request-form";
import { RequestQueue } from "@/components/requests/request-queue";
import { requirePageAccess } from "@/lib/auth/guard";
import { hasPermission } from "@/lib/auth/permissions";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore } from "@/lib/data/flow-store";
import { isActiveProject } from "@/lib/data/entity-filters";
import {
  listActiveTickets,
  listRecentTickets,
  listTicketsForRequester,
} from "@/lib/requests/tickets";
import { appTodayDate } from "@/lib/datetime/timezone";

function turnaroundMinutes(claimedAt: string | null, completedAt: string | null): number | null {
  if (!claimedAt || !completedAt) return null;
  return Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(claimedAt).getTime()) / 60000));
}

export default async function RequestsPage() {
  const user = await requirePageAccess("/requests");
  await ensureAppDataLoaded();
  const [active, recent, mine] = await Promise.all([
    listActiveTickets(),
    listRecentTickets(100),
    listTicketsForRequester(user.id),
  ]);

  const open = active.filter((t) => t.status === "open").length;
  const inProgress = active.filter((t) => t.status === "claimed").length;
  const today = appTodayDate();
  const doneToday = recent.filter(
    (t) => t.status === "done" && (t.completed_at ?? "").startsWith(today)
  ).length;
  const turnarounds = recent
    .map((t) => turnaroundMinutes(t.claimed_at, t.completed_at))
    .filter((n): n is number => n != null);
  const avgTurnaround =
    turnarounds.length > 0
      ? Math.round(turnarounds.reduce((s, n) => s + n, 0) / turnarounds.length)
      : null;

  const convertProjects = hasPermission(user.role, "work:assign")
    ? getFlowStore()
        .projects.filter(isActiveProject)
        .map((p) => ({ id: p.id, name: p.name }))
    : undefined;

  return (
    <FlowPageShell
      title="Requests"
      eyebrow={PLATFORM_EYEBROWS.operations}
      breadcrumbs={[{ label: "Requests" }]}
      description="Team requests: submitted by anyone, claimed first-come, tracked to done"
      kpis={
        <KpiStrip
          columns={4}
          items={[
            { id: "open", label: "Waiting for pickup", value: open, warn: open > 0 },
            { id: "progress", label: "In progress", value: inProgress },
            { id: "done", label: "Done today", value: doneToday },
            {
              id: "turnaround",
              label: "Avg claim → done",
              value: avgTurnaround != null ? `${avgTurnaround}m` : "—",
            },
          ]}
        />
      }
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6 p-4 sm:p-5">
          <LiveRefresh intervalMs={45_000} />
          <RequestQueue
            tickets={active}
            currentUserId={user.id}
            showClaimedByOthers
            convertProjects={convertProjects}
          />
          <RequestForm />
          <div>
            <p className="flow-section-title mb-2">Your requests</p>
            <MyRequestsList tickets={mine} />
          </div>
          <div>
            <p className="flow-section-title mb-2">Recent history</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border/50">
                    <th className="px-3 py-2 font-medium">Request</th>
                    <th className="px-3 py-2 font-medium">From</th>
                    <th className="px-3 py-2 font-medium">Handled by</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Claim → done</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, 30).map((t) => {
                    const mins = turnaroundMinutes(t.claimed_at, t.completed_at);
                    return (
                      <tr key={t.id} className="border-b border-border/30">
                        <td className="px-3 py-2 max-w-[320px] truncate">{t.title}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{t.requested_by_name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{t.claimed_by_name ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="outline" className="capitalize">
                            {t.status}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {mins != null ? `${mins}m` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </WorkspaceContainer>
      }
    />
  );
}
