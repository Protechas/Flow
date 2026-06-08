"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { EMPLOYEE_NAV } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LogOut, Waves } from "lucide-react";
import { userDisplayInitials } from "@/lib/users/format";
import { cn } from "@/lib/utils";
import type { User } from "@/types/flow";

export function EmployeeHeader({
  user,
  demoMode,
}: {
  user: User;
  demoMode?: boolean;
}) {
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur-md">
      <div className="max-w-3xl mx-auto px-4 py-3 sm:px-6 space-y-3">
        <div className="flex items-center gap-3">
          <Link href="/work" className="flex items-center gap-2 shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600">
              <Waves className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-lg hidden sm:inline">Flow</span>
          </Link>
          <nav className="flex-1 flex gap-1 justify-center">
            {EMPLOYEE_NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "text-sm px-3 py-1.5 rounded-md transition-colors",
                    active
                      ? "bg-violet-500/15 text-violet-300 font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
            <div className="h-8 w-8 rounded-full bg-violet-500/20 flex items-center justify-center text-xs font-semibold hidden sm:flex">
              {userDisplayInitials(user)}
            </div>
            {demoMode && (
              <Badge variant="outline" className="text-violet-400 border-violet-500/30 text-[10px]">
                Demo
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
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
