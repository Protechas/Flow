import { EmployeeHeader } from "@/components/employee/employee-header";
import { getCurrentUser } from "@/lib/auth/session";
import { isEmployeeRole } from "@/lib/auth/permissions";
import { getDefaultRoute } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { getDemoUserId } from "@/lib/auth/demo-session";
import { redirect } from "next/navigation";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!isEmployeeRole(user.role)) redirect(getDefaultRoute(user.role));

  const demoMode = !isSupabaseConfigured();
  const hasDemoCookie = demoMode ? !!(await getDemoUserId()) : false;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <EmployeeHeader user={user} demoMode={demoMode && hasDemoCookie} />
      <main className="flex-1 px-3 py-4 sm:px-6 sm:py-6 max-w-3xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
