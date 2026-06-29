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
    await hydrateForecastSettings();
    const { hydrateWorkloadAlertSettings } = await import("@/lib/workload-alerts/hydrate");
    await hydrateWorkloadAlertSettings();
    const { hydrateHelpFlagSettings } = await import("@/lib/help-flags/hydrate");
    await hydrateHelpFlagSettings();
    const { hydrateWorkVisibilitySettings } = await import("@/lib/work-visibility/hydrate");
    await hydrateWorkVisibilitySettings();
  } else {
    initFlowStore();
    await hydrateForecastSettings();
    const { hydrateWorkloadAlertSettings } = await import("@/lib/workload-alerts/hydrate");
    await hydrateWorkloadAlertSettings();
    const { hydrateHelpFlagSettings } = await import("@/lib/help-flags/hydrate");
    await hydrateHelpFlagSettings();
    const { hydrateWorkVisibilitySettings } = await import("@/lib/work-visibility/hydrate");
    await hydrateWorkVisibilitySettings();
  }

  const store = getFlowStore();
  const teamDashboardNav = getTeamDashboardNavItemsForUser(user, store.teams, store.users);

  const demoMode = !isSupabaseConfigured();
  const hasDemoCookie = demoMode ? !!(await getDemoUserId()) : false;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} teamDashboardNav={teamDashboardNav} />
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
