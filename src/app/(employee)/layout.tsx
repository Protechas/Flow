import { EmployeeHeader } from "@/components/employee/employee-header";
import { getCurrentUser } from "@/lib/auth/session";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { getDefaultRoute } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { hydrateAppStore } from "@/lib/data/users";
import { getDemoUserId } from "@/lib/auth/demo-session";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { getActiveClockEntry, getTodayClockEntries } from "@/lib/data/production-tracking";
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
    await hydrateAppStore();
  } else {
    await hydrateForecastSettings();
  }

  const demoMode = !isSupabaseConfigured();
  const hasDemoCookie = demoMode ? !!(await getDemoUserId()) : false;
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
      <main className="flex-1 flow-layer-content px-3 py-4 sm:px-6 sm:py-6 max-w-4xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
