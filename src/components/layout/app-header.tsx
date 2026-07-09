"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { enterEmployeePreviewAction } from "@/app/actions/employee-preview";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { roleLabel } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { getPageTitle } from "@/lib/navigation/page-titles";
import { Eye, LogOut, Search } from "lucide-react";
import type { User } from "@/types/flow";

interface AppHeaderProps {
  user: User;
  demoMode?: boolean;
}

export function AppHeader({ user, demoMode }: AppHeaderProps) {
  const [pending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const pageTitle = getPageTitle(pathname);

  return (
    <header className="flow-command-bar flex h-12 shrink-0 items-center gap-3 px-4 lg:px-6 sticky top-0 z-10">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5 bg-[var(--border-subtle)]" />
      {/* The hero below the bar already names the page — only show the title
          here when there's honest room for it, never truncated to nothing */}
      <div className="hidden lg:flex flex-1 items-center gap-2 min-w-0">
        <span className="flow-hero-eyebrow text-[10px]">Flow</span>
        <h1 className="flow-page-title truncate">{pageTitle}</h1>
      </div>

      <div className="relative hidden md:block flex-1 lg:flex-none max-w-xs lg:w-72 ml-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search operations…"
          className="h-8 pl-8 text-xs bg-secondary/50 border-transparent focus-visible:bg-background focus-visible:border-input"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const q = (e.target as HTMLInputElement).value.trim();
              router.push(q ? `/operations?search=${encodeURIComponent(q)}` : "/operations");
            }
          }}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => enterEmployeePreviewAction())}
          className="hidden h-8 gap-1.5 text-xs sm:inline-flex"
          title="See Flow the way your team sees it"
        >
          <Eye className="h-3.5 w-3.5" />
          Employee view
        </Button>
        <ThemeSwitcher compact />
        <NotificationBell />
        {demoMode && (
          <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
            Demo
          </Badge>
        )}
        <Separator orientation="vertical" className="h-4 hidden sm:block" />
        <div className="hidden sm:flex flex-col items-end min-w-0">
          <span className="text-xs font-medium truncate max-w-[140px]">{user.full_name}</span>
          <span className="text-[10px] text-muted-foreground capitalize">{roleLabel(user.role)}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => logoutAction())}
          className="text-muted-foreground h-8 px-2"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
          <span className="sr-only">Logout</span>
        </Button>
      </div>
    </header>
  );
}
