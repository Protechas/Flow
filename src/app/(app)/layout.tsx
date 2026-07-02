import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isEmployeeUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { getTeamDashboardNavItemsForUser } from "@/lib/team-dashboards/nav";
import { loadHiddenNavItemIds } from "@/lib/auth/feature-access-loader";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getDemoUserId } from "@/lib/auth/demo-session";
import { InnovationHubBubble } from "@/components/innovation-hub/innovation-hub-bubble";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isEmployeeUser(user)) redirect("/work");

  if (isSupabaseConfigured()) {
    await ensureAppDataLoaded();
  } else {
    initFlowStore();
  }

  // Independent settings loads — run in parallel on every page view.
  const [{ hydrateWorkloadAlertSettings }, { hydrateHelpFlagSettings }, { hydrateWorkVisibilitySettings }] =
    await Promise.all([
      import("@/lib/workload-alerts/hydrate"),
      import("@/lib/help-flags/hydrate"),
      import("@/lib/work-visibility/hydrate"),
    ]);
  await Promise.all([
    hydrateForecastSettings(),
    hydrateWorkloadAlertSettings(),
    hydrateHelpFlagSettings(),
    hydrateWorkVisibilitySettings(),
  ]);

  const store = getFlowStore();
  const teamDashboardNav = getTeamDashboardNavItemsForUser(user, store.teams, store.users);
  const hiddenNavIds = await loadHiddenNavItemIds(user);

  const demoMode = !isSupabaseConfigured();
  const hasDemoCookie = demoMode ? !!(await getDemoUserId()) : false;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} teamDashboardNav={teamDashboardNav} hiddenNavIds={hiddenNavIds} />
        <SidebarInset className="flow-layer-content min-h-svh min-w-0 overflow-x-hidden">
          <AppHeader user={user} demoMode={demoMode && hasDemoCookie} />
          <div className="flow-app-content flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full min-w-0 overflow-x-hidden">
            {children}
          </div>
          <InnovationHubBubble />
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
