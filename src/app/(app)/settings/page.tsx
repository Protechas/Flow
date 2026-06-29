import { DemoRoleSwitcher } from "@/components/auth/demo-role-switcher";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsMetricsPanel } from "@/components/settings/settings-metrics-panel";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { requirePageAccess } from "@/lib/auth/guard";
import { getDemoUsersForLogin } from "@/lib/auth/demo-session";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { hasPermission } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { USER_ROLES } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const user = await requirePageAccess("/settings");
  const role = getEffectivePermissionRole(user);
  const canManagePlatform = hasPermission(role, "settings:manage");
  const canEditMetrics =
    hasPermission(role, "settings:manage") || hasPermission(role, "settings:metrics");
  const forecastSettings = canEditMetrics ? await hydrateForecastSettings() : null;
  const demoMode = !isSupabaseConfigured();

  return (
    <>
      <PageHeader title="Settings" description="Account, metrics, and platform configuration" />
      <div className="grid gap-6 max-w-3xl">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <p className="text-xs text-muted-foreground">
              Read-only — contact an administrator to update name, email, or role.
            </p>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user.full_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span>{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Role</span>
              <Badge variant="secondary" className="capitalize">
                {user.role}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {canEditMetrics && forecastSettings && (
          <Card className="border-border/60">
            <CardHeader>
              <CardTitle className="text-base">Forecasting &amp; production metrics</CardTitle>
              <p className="text-xs text-muted-foreground">
                Adjust how Flow calculates due dates from estimated files on project tasks.
                Changes apply across Projects, Operations, Planning, and Reports.
              </p>
            </CardHeader>
            <CardContent>
              <SettingsMetricsPanel settings={forecastSettings} canEdit={canEditMetrics} />
            </CardContent>
          </Card>
        )}

        {demoMode && (
          <DemoRoleSwitcher users={getDemoUsersForLogin()} currentUserId={user.id} />
        )}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flow-helper mb-3">
              Flow Executive Dark is the default premium operations theme. A soft green accent is
              used sparingly for focus and actions.
            </p>
            <ThemeSwitcher />
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Platform</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data source</span>
              <Badge variant="outline">{demoMode ? "Demo (in-memory)" : "Supabase"}</Badge>
            </div>
            {canManagePlatform && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Roles</span>
                <span className="text-muted-foreground text-right">
                  {USER_ROLES.map((r) => r.label).join(", ")}
                </span>
              </div>
            )}
            {canManagePlatform && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" render={<Link href="/settings/users" />}>
                  Manage users
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/system-health" />}>
                  System health
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/departments" />}>
                  Manage departments
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/workload-alerts" />}>
                  Workload alerts
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/work-visibility" />}>
                  Work visibility
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/help-flags" />}>
                  Help flag settings
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/team-dashboards" />}>
                  Team dashboards
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/operating-models" />}>
                  Operating models
                </Button>
                {hasPermission(role, "validation:manage_settings") && (
                  <Button variant="outline" size="sm" render={<Link href="/validation/settings" />}>
                    Validation settings
                  </Button>
                )}
                <Button variant="outline" size="sm" render={<Link href="/docs" />}>
                  Help &amp; docs
                </Button>
              </div>
            )}
            {!canManagePlatform && canEditMetrics && (
              <p className="text-xs text-muted-foreground pt-1">
                Additional platform administration is available to system administrators.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
