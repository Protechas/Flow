import { EmployeeHeader } from "@/components/employee/employee-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getDefaultRoute, isEmployeeRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getDemoUserId } from "@/lib/auth/demo-session";
import { loadHiddenEmployeeNavHrefs } from "@/lib/auth/feature-access-loader";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { getActiveClockEntry, getTodayClockEntries } from "@/lib/data/production-tracking";
import { InnovationHubBubble } from "@/components/innovation-hub/innovation-hub-bubble";
import { redirect } from "next/navigation";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isEmployeeRole(user.role)) redirect(getDefaultRoute(user.role));

  if (isSupabaseConfigured()) {
    await ensureAppDataLoaded();
  } else {
    await hydrateForecastSettings();
  }

  const demoMode = !isSupabaseConfigured();
  const hasDemoCookie = demoMode ? !!(await getDemoUserId()) : false;
  const hiddenEmployeeNavHrefs = await loadHiddenEmployeeNavHrefs(user);
  const activeClock = getActiveClockEntry(user.id);
  const todayClockEntries = getTodayClockEntries(user.id);

  return (
    <div className="min-h-screen flex flex-col">
      <EmployeeHeader
        user={user}
        demoMode={demoMode && hasDemoCookie}
        hiddenNavHrefs={hiddenEmployeeNavHrefs}
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
