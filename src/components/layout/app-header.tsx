"use client";

import { useTransition } from "react";
import { logoutAction } from "@/app/actions/auth";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { LogOut } from "lucide-react";
import type { User } from "@/types/flow";

interface AppHeaderProps {
  user: User;
  demoMode?: boolean;
}

export function AppHeader({ user, demoMode }: AppHeaderProps) {
  const [pending, startTransition] = useTransition();

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-4 sticky top-0 z-10">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <span className="text-sm text-muted-foreground hidden sm:inline">{user.full_name}</span>
      <Badge variant="outline" className="capitalize text-[10px] hidden sm:inline-flex">
        {user.role}
      </Badge>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        {demoMode && (
          <Badge variant="outline" className="text-primary border-primary/30 text-[10px]">
            Demo
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => startTransition(() => logoutAction())}
          className="text-muted-foreground h-8"
        >
          <LogOut className="h-4 w-4 mr-1" />
          Logout
        </Button>
      </div>
    </header>
  );
}
