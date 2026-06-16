"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { ClockStatusBadge } from "@/components/enterprise/clock-status-badge";
import { PayTypeBadge } from "@/components/enterprise/pay-type-badge";
import { EMPLOYEE_NAV } from "@/lib/auth/permissions";
import { getEmployeeClockStatus } from "@/lib/time-clock/labels";
import { requiresShiftClock } from "@/lib/users/pay-type";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { LogOut } from "lucide-react";
import { userDisplayInitials } from "@/lib/users/format";
import { cn } from "@/lib/utils";
import type { TimeClockEntry, User } from "@/types/flow";

export function EmployeeHeader({
  user,
  demoMode,
  activeClock,
  todayClockEntries = [],
}: {
  user: User;
  demoMode?: boolean;
  activeClock?: TimeClockEntry | null;
  todayClockEntries?: TimeClockEntry[];
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const clockStatus = getEmployeeClockStatus(activeClock ?? null, todayClockEntries);
  const useShiftClock = requiresShiftClock(user);

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border-subtle)] flow-command-bar">
      <div className="max-w-4xl mx-auto px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/work" className="flex items-center gap-2 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-primary-foreground text-xs font-bold">
              F
            </div>
            <span className="font-semibold text-sm hidden sm:inline text-foreground">Flow</span>
          </Link>

          <nav className="flex-1 flex gap-0.5 justify-center">
            {EMPLOYEE_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-sm transition-colors font-medium",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {useShiftClock ? (
              <ClockStatusBadge status={clockStatus} className="hidden sm:inline-flex" />
            ) : (
              <PayTypeBadge payType="salary" className="hidden sm:inline-flex" />
            )}
            <ThemeSwitcher compact />
            <NotificationBell />
            <div className="h-7 w-7 rounded-sm bg-muted flex items-center justify-center text-[10px] font-semibold hidden sm:flex text-muted-foreground">
              {userDisplayInitials(user)}
            </div>
            {demoMode && (
              <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
                Demo
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pending}
              onClick={() => startTransition(() => logoutAction())}
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
