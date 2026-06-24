import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { EmployeeHeader } from "@/components/employee/employee-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InnovationHubBubble } from "@/components/innovation-hub/innovation-hub-bubble";
import { getDemoUserId } from "@/lib/auth/demo-session";
import { isEmployeeUser, getCurrentUser } from "@/lib/auth/session";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { getActiveClockEntry, getTodayClockEntries } from "@/lib/data/production-tracking";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { redirect } from "next/navigation";

export default async function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (isSupabaseConfigured()) {
    await ensureAppDataLoaded();
  } else {
    await hydrateForecastSettings();
  }

  const demoMode = !isSupabaseConfigured();
  const hasDemoCookie = demoMode ? !!(await getDemoUserId()) : false;

  if (isEmployeeUser(user)) {
    const activeClock = getActiveClockEntry(user.id);
    const todayClockEntries = getTodayClockEntries(user.id);

    return (
      <div className="min-h-screen flex flex-col">
        <EmployeeHeader
          user={user}
          demoMode={demoMode && hasDemoCookie}
          activeClock={activeClock}
          todayClockEntries={todayClockEntries}
        />
        <main className="flex-1 flow-layer-content px-3 py-4 sm:px-6 sm:py-6 max-w-6xl mx-auto w-full">
          {children}
        </main>
        <InnovationHubBubble />
      </div>
    );
  }

  if (isSupabaseConfigured()) {
    await hydrateForecastSettings();
    const { hydrateWorkloadAlertSettings } = await import("@/lib/workload-alerts/hydrate");
    await hydrateWorkloadAlertSettings();
    const { hydrateHelpFlagSettings } = await import("@/lib/help-flags/hydrate");
    await hydrateHelpFlagSettings();
  } else {
    await hydrateForecastSettings();
    const { hydrateWorkloadAlertSettings } = await import("@/lib/workload-alerts/hydrate");
    await hydrateWorkloadAlertSettings();
    const { hydrateHelpFlagSettings } = await import("@/lib/help-flags/hydrate");
    await hydrateHelpFlagSettings();
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} />
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
