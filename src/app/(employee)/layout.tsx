import { EmployeeHeader } from "@/components/employee/employee-header";
import { getCurrentUser, isEmployeeUser } from "@/lib/auth/session";
import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { getDefaultRoute } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { getDemoUserId } from "@/lib/auth/demo-session";
import { loadHiddenEmployeeNavHrefs } from "@/lib/auth/feature-access-loader";
import { hydrateForecastSettings } from "@/lib/forecast/hydrate";
import { getActiveClockEntry, getTodayClockEntries } from "@/lib/data/production-tracking";
import { InnovationHubBubble } from "@/components/innovation-hub/innovation-hub-bubble";
import { AskEddyBubble } from "@/components/eddy/eddy-bubble";
import { SopAcknowledgmentGate } from "@/components/files/sop-acknowledgment-gate";
import { accentValue } from "@/lib/badges/cosmetic-types";
import {
  canUseEmployeePreview,
  isEmployeePreviewActive,
} from "@/lib/auth/employee-preview";
import { EmployeePreviewBanner } from "@/components/employee/employee-preview-banner";
import { redirect } from "next/navigation";

export default async function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Must mirror the (app) layout's isEmployeeUser check — deriving from the
  // legacy role column here while (app) uses the effective permission role
  // sent mismatched accounts into a /work ↔ /operations redirect loop.
  // Exception: leads/managers in employee-preview mode see this shell.
  const previewMode =
    !isEmployeeUser(user) &&
    canUseEmployeePreview(user) &&
    (await isEmployeePreviewActive());
  if (!isEmployeeUser(user) && !previewMode) {
    redirect(getDefaultRoute(getEffectivePermissionRole(user)));
  }

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

  // Cosmetic accent: earned via badges, applies to this employee's own view.
  const accent = accentValue(user.accent_color);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={accent ? ({ "--primary": accent } as React.CSSProperties) : undefined}
    >
      {previewMode && <EmployeePreviewBanner />}
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
      <AskEddyBubble />
      {/* Blocks the workspace until published SOP revisions are accepted. */}
      {!previewMode && <SopAcknowledgmentGate />}
    </div>
  );
}
