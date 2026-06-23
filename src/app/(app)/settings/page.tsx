import { DemoRoleSwitcher } from "@/components/auth/demo-role-switcher";
import { PageHeader } from "@/components/layout/page-header";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth/session";
import { requirePageAccess } from "@/lib/auth/guard";
import { getDemoUsersForLogin } from "@/lib/auth/demo-session";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { USER_ROLES } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const user = await requirePageAccess("/settings");
  const demoMode = !isSupabaseConfigured();

  return (
    <>
      <PageHeader title="Settings" description="Account and platform configuration" />
      <div className="grid gap-6 max-w-2xl">
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
              <Badge variant="secondary" className="capitalize">{user.role}</Badge>
            </div>
          </CardContent>
        </Card>

        {demoMode && (
          <DemoRoleSwitcher
            users={getDemoUsersForLogin()}
            currentUserId={user.id}
          />
        )}

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="flow-helper mb-3">
              Flow Executive Dark is the default premium operations theme. A soft green accent is used sparingly for focus and actions.
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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Roles</span>
              <span className="text-muted-foreground text-right">{USER_ROLES.map((r) => r.label).join(", ")}</span>
            </div>
            {(user.role === "admin" || user.role === "super_admin") && (
              <>
                <Button variant="outline" size="sm" render={<Link href="/settings/users" />}>
                  Manage users
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/system-health" />}>
                  System health
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/departments" />}>
                  Manage departments
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/forecasting" />}>
                  Forecasting settings
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/workload-alerts" />}>
                  Workload alerts
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/settings/work-visibility" />}>
                  Work visibility
                </Button>
                <Button variant="outline" size="sm" render={<Link href="/docs" />}>
                  Help &amp; docs
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
