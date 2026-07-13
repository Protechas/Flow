"use client";

import { Progress } from "@/components/ui/progress";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface RequestTrendPoint {
  label: string;
  submitted: number;
  done: number;
}

export interface RequestHandlerStat {
  name: string;
  done: number;
  avgMins: number | null;
  holding: number;
}

export interface RequestRequesterStat {
  name: string;
  total: number;
  done: number;
  waiting: number;
}

export interface RequestResponseProfile {
  submitted7d: number;
  urgent7d: number;
  avgPickup: number | null;
  avgTurnaround: number | null;
}

/** Detailed request metrics in the app's standard visual language. */
export function RequestMetrics({
  trend,
  handlers,
  requesters,
  profile,
}: {
  trend: RequestTrendPoint[];
  handlers: RequestHandlerStat[];
  requesters: RequestRequesterStat[];
  profile: RequestResponseProfile;
}) {
  const hasVolume = trend.some((p) => p.submitted > 0 || p.done > 0);
  const maxHandled = Math.max(1, ...handlers.map((h) => h.done));
  const maxRequested = Math.max(1, ...requesters.map((r) => r.total));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="enterprise-panel p-4 lg:col-span-2">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            Volume — last 14 days
          </p>
          {hasVolume ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={trend} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.15 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 4,
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="submitted" name="Submitted" fill="var(--chart-2)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="done" name="Done" fill="var(--chart-1)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="rounded-md border border-dashed border-border/60 px-3 py-8 text-center">
              <p className="text-xs text-muted-foreground">
                The chart fills in as requests flow through.
              </p>
            </div>
          )}
        </div>

        <div className="enterprise-panel p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Response profile</p>
          <div className="grid grid-cols-2 gap-3">
            <ProfileTile label="This week" value={String(profile.submitted7d)} />
            <ProfileTile
              label="Urgent"
              value={String(profile.urgent7d)}
              warn={profile.urgent7d > 0}
            />
            <ProfileTile
              label="To pickup"
              value={profile.avgPickup != null ? `${profile.avgPickup}m` : "—"}
            />
            <ProfileTile
              label="Claim → done"
              value={profile.avgTurnaround != null ? `${profile.avgTurnaround}m` : "—"}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="enterprise-panel p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Handled by</p>
          {handlers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tickets handled yet.</p>
          ) : (
            <div className="space-y-3">
              {handlers.map((h) => (
                <div key={h.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs gap-2">
                    <span className="font-medium truncate">{h.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {h.done} done
                      {h.avgMins != null ? ` · avg ${h.avgMins}m` : ""}
                      {h.holding > 0 ? ` · ${h.holding} in hand` : ""}
                    </span>
                  </div>
                  <Progress value={(h.done / maxHandled) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="enterprise-panel p-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Requested by</p>
          {requesters.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requesters.map((r) => (
                <div key={r.name} className="space-y-1.5">
                  <div className="flex justify-between text-xs gap-2">
                    <span className="font-medium truncate">{r.name}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      {r.total} submitted · {r.done} done
                      {r.waiting > 0 ? ` · ${r.waiting} waiting` : ""}
                    </span>
                  </div>
                  <Progress value={(r.total / maxRequested) * 100} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProfileTile({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-[var(--flow-radius-card)] border border-border/50 bg-muted/15 px-3 py-2.5">
      <p className="enterprise-label">{label}</p>
      <p className={`font-semibold tabular-nums mt-1 ${warn ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}
