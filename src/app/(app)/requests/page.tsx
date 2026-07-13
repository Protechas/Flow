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

  // Detailed metrics, all from the same recent-tickets fetch (last 100).
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const submitted7d = recent.filter((t) => t.created_at >= weekAgo);
  const urgent7d = submitted7d.filter((t) => t.priority === "urgent").length;

  const byHandler = new Map<
    string,
    { name: string; done: number; totalMins: number; timed: number; holding: number }
  >();
  for (const t of recent) {
    if (!t.claimed_by) continue;
    const entry = byHandler.get(t.claimed_by) ?? {
      name: t.claimed_by_name ?? t.claimed_by,
      done: 0,
      totalMins: 0,
      timed: 0,
      holding: 0,
    };
    if (t.status === "done") {
      entry.done += 1;
      const mins = turnaroundMinutes(t.claimed_at, t.completed_at);
      if (mins != null) {
        entry.totalMins += mins;
        entry.timed += 1;
      }
    } else if (t.status === "claimed") {
      entry.holding += 1;
    }
    byHandler.set(t.claimed_by, entry);
  }
  const handlers = [...byHandler.values()].sort((a, b) => b.done - a.done);

  const byRequester = new Map<string, { name: string; total: number; done: number; waiting: number }>();
  for (const t of recent) {
    const entry = byRequester.get(t.requested_by) ?? {
      name: t.requested_by_name,
      total: 0,
      done: 0,
      waiting: 0,
    };
    entry.total += 1;
    if (t.status === "done") entry.done += 1;
    if (t.status === "open") entry.waiting += 1;
    byRequester.set(t.requested_by, entry);
  }
  const requesters = [...byRequester.values()].sort((a, b) => b.total - a.total);

  // How long open tickets sit before pickup — the other half of response time.
  const pickupTimes = recent
    .map((t) =>
      t.claimed_at
        ? Math.max(
            0,
            Math.round((new Date(t.claimed_at).getTime() - new Date(t.created_at).getTime()) / 60000)
          )
        : null
    )
    .filter((n): n is number => n != null);
  const avgPickup =
    pickupTimes.length > 0
      ? Math.round(pickupTimes.reduce((s, n) => s + n, 0) / pickupTimes.length)
      : null;

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
            <p className="flow-section-title mb-2">Detailed metrics</p>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="rounded-[var(--flow-radius-card)] border border-border/50 bg-muted/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Handled by
                </p>
                {handlers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tickets handled yet.</p>
                ) : (
                  <div className="space-y-2">
                    {handlers.map((h) => (
                      <div key={h.name} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{h.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {h.done} done
                          {h.timed > 0 ? ` · avg ${Math.round(h.totalMins / h.timed)}m` : ""}
                          {h.holding > 0 ? ` · ${h.holding} in hand` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-[var(--flow-radius-card)] border border-border/50 bg-muted/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Requested by
                </p>
                {requesters.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No requests yet.</p>
                ) : (
                  <div className="space-y-2">
                    {requesters.map((r) => (
                      <div key={r.name} className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{r.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {r.total} submitted · {r.done} done
                          {r.waiting > 0 ? ` · ${r.waiting} waiting` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-[var(--flow-radius-card)] border border-border/50 bg-muted/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Response profile
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span>Submitted this week</span>
                    <span className="font-semibold tabular-nums">{submitted7d.length}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span>Urgent this week</span>
                    <span className="font-semibold tabular-nums">{urgent7d}</span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span>Avg time to pickup</span>
                    <span className="font-semibold tabular-nums">
                      {avgPickup != null ? `${avgPickup}m` : "—"}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span>Avg claim → done</span>
                    <span className="font-semibold tabular-nums">
                      {avgTurnaround != null ? `${avgTurnaround}m` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
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
