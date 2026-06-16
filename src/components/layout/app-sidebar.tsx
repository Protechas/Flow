"use client";



import Link from "next/link";

import { usePathname } from "next/navigation";

import {
  Activity,
  BarChart3,
  BellRing,
  Building2,
  Clock,
  FileStack,
  FolderKanban,
  Kanban,
  LayoutDashboard,
  LayoutTemplate,
  Moon,
  Network,
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

import { AppVersionBadge } from "@/components/layout/app-version-badge";
import { roleLabel } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

import { getEffectivePermissionRole } from "@/lib/auth/access-level";
import { getNavGroupsForRole } from "@/lib/auth/permissions";

import { userDisplayInitials } from "@/lib/users/format";

import { cn } from "@/lib/utils";

import type { User } from "@/types/flow";



const ICONS = {

  LayoutDashboard,
  LayoutTemplate,
  Kanban,

  FolderKanban,

  Users,

  Activity,

  Clock,

  ShieldCheck,

  BarChart3,

  Moon,

  Settings,

  UserCog,

  Building2,

  FileStack,

  Network,

  BellRing,

} as const;

interface AppSidebarProps {
  user: User;
}



export function AppSidebar({ user }: AppSidebarProps) {

  const pathname = usePathname();

  const navGroups = getNavGroupsForRole(getEffectivePermissionRole(user));

  const homeHref = navGroups[0]?.items[0]?.href ?? "/operations";



  return (

    <Sidebar collapsible="icon" className="flow-layer-sidebar flow-sidebar-console border-r-0 shadow-none">

      <SidebarHeader className="border-b border-[var(--border-subtle)] px-3 py-4">

        <Link href={homeHref} className="flex items-center gap-3">

          <div className="flow-brand-mark h-8 w-8 text-sm">

            F

          </div>

          <div className="flex flex-col group-data-[collapsible=icon]:hidden">

            <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">Flow</span>

            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">Operations Command</span>

          </div>

        </Link>

      </SidebarHeader>

      <SidebarContent className="px-2 py-2">

        {navGroups.map((group) => (

          <SidebarGroup key={group.group}>

            <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">

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

                        className={cn("text-[13px] h-9 relative rounded-md", active && "flow-sidebar-nav-active")}

                      >

                        <Icon className="h-4 w-4 opacity-80" />

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

      <SidebarFooter className="border-t border-[var(--border-subtle)] p-2">

        <div className="flex items-center gap-2 px-1 py-1 group-data-[collapsible=icon]:justify-center">

          <div className="h-7 w-7 rounded-sm bg-muted flex items-center justify-center text-[10px] font-semibold overflow-hidden text-muted-foreground shrink-0">

            {user.avatar_url ? (

              // eslint-disable-next-line @next/next/no-img-element

              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />

            ) : (

              userDisplayInitials(user)

            )}

          </div>

          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">

            <span className="text-xs font-medium truncate text-sidebar-foreground">{user.full_name}</span>

            <Badge variant="outline" className="w-fit text-[10px] capitalize mt-0.5 h-4 px-1.5">

              {roleLabel(user.role)}

            </Badge>

          </div>

        </div>

        <AppVersionBadge />

      </SidebarFooter>

      <SidebarRail />

    </Sidebar>

  );

}

