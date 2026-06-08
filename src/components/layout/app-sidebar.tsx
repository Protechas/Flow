"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { getNavGroupsForRole } from "@/lib/auth/permissions";
import { userDisplayInitials } from "@/lib/users/format";
import type { User } from "@/types/flow";

const ICONS = {
  LayoutDashboard,
  Kanban,
  FolderKanban,
  Users,
  Activity,
  ShieldCheck,
  BarChart3,
  Settings,
  UserCog,
} as const;

interface AppSidebarProps {
  user: User;
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const navGroups = getNavGroupsForRole(user.role);
  const homeHref = navGroups[0]?.items[0]?.href ?? "/operations";

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar">
      <SidebarHeader className="border-b border-border px-4 py-3.5">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">
            F
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm tracking-tight text-foreground">Flow</span>
            <span className="text-[10px] text-muted-foreground">Operations Platform</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.group}>
            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon as keyof typeof ICONS] ?? LayoutDashboard;
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={`${group.group}-${item.id}`}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={active}
                        tooltip={item.label}
                        className="text-sm"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-border p-3">
        <div className="flex items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center">
          <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center text-xs font-semibold overflow-hidden text-muted-foreground">
            {user.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              userDisplayInitials(user)
            )}
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium truncate">{user.full_name}</span>
            <Badge variant="outline" className="w-fit text-[10px] capitalize mt-0.5">
              {user.role}
            </Badge>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
