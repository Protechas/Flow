import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isEmployeeUser } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/session";
import { hydrateAppStore } from "@/lib/data/users";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getDemoUserId } from "@/lib/auth/demo-session";
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
    await hydrateAppStore();
  } else {
    await hydrateForecastSettings();
    const { hydrateWorkloadAlertSettings } = await import("@/lib/workload-alerts/hydrate");
    await hydrateWorkloadAlertSettings();
    const { hydrateHelpFlagSettings } = await import("@/lib/help-flags/hydrate");
    await hydrateHelpFlagSettings();
  }

  const demoMode = !isSupabaseConfigured();
  const hasDemoCookie = demoMode ? !!(await getDemoUserId()) : false;

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar user={user} />
        <SidebarInset className="flow-layer-content min-h-svh">
          <AppHeader user={user} demoMode={demoMode && hasDemoCookie} />
          <main className="flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto w-full">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
