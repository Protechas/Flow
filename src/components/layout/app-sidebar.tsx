"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  BellRing,
  Building2,
  ChevronDown,
  ClipboardList,
  Clock,
  Factory,
  FileStack,
  FolderKanban,
  HeartPulse,
  Kanban,
  LayoutDashboard,
  LayoutTemplate,
  Lightbulb,
  LineChart,
  Network,
  Settings,
  ShieldCheck,
  TrendingUp,
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
import {
  getNavGroupsForRole,
  NAV_PRIMARY_ITEM_IDS,
  type NavGroupId,
} from "@/lib/auth/permissions";
import { userDisplayInitials } from "@/lib/users/format";
import { cn } from "@/lib/utils";
import type { User } from "@/types/flow";

const ICONS = {
  LayoutDashboard,
  LayoutTemplate,
  Kanban,
  FolderKanban,
  Users,
  LineChart,
  Clock,
  ShieldCheck,
  BarChart3,
  ClipboardList,
  Settings,
  UserCog,
  Building2,
  FileStack,
  Network,
  BellRing,
  Lightbulb,
  Factory,
  HeartPulse,
  TrendingUp,
} as const;

const SIDEBAR_SECTIONS_STORAGE_KEY = "flow-sidebar-sections";

const PRIORITY_GROUPS: NavGroupId[] = ["dashboard", "attention", "operations"];

interface AppSidebarProps {
  user: User;
}

function isNavItemActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname();
  const navGroups = getNavGroupsForRole(getEffectivePermissionRole(user));
  const homeHref = navGroups[0]?.items[0]?.href ?? "/operations";

  const [collapsedSections, setCollapsedSections] = useState<Partial<Record<NavGroupId, boolean>>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
      if (raw) {
        setCollapsedSections(JSON.parse(raw) as Partial<Record<NavGroupId, boolean>>);
      }
    } catch {
      // Ignore invalid stored state.
    }
  }, []);

  const toggleSection = useCallback((groupId: NavGroupId, hasActiveItem: boolean) => {
    if (hasActiveItem) return;

    setCollapsedSections((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      try {
        localStorage.setItem(SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage failures.
      }
      return next;
    });
  }, []);

  const primaryItemIds = useMemo(() => new Set(NAV_PRIMARY_ITEM_IDS), []);

  return (
    <Sidebar collapsible="icon" className="flow-layer-sidebar flow-sidebar-console border-r-0 shadow-none">
      <SidebarHeader className="flow-glass-bar border-b border-[var(--border-subtle)] mx-2 mt-2 mb-1 px-3 py-3.5 rounded-[var(--flow-radius-panel)]">
        <Link href={homeHref} className="flex items-center gap-3">
          <div className="flow-brand-mark h-8 w-8 text-sm">F</div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-sm tracking-tight text-sidebar-foreground">Flow</span>
            <span className="text-[10px] text-muted-foreground leading-none mt-0.5">Operations Platform</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent className="px-2 py-2">
        {navGroups.map((group) => {
          const hasActiveItem = group.items.some((item) => isNavItemActive(pathname, item.href));
          const isSectionCollapsed = Boolean(collapsedSections[group.group]) && !hasActiveItem;
          const isPriorityGroup = PRIORITY_GROUPS.includes(group.group);
          const isAdminGroup = group.group === "administration";

          return (
            <SidebarGroup key={group.group} className="flow-sidebar-section">
              <SidebarGroupLabel
                className={cn(
                  "flow-sidebar-section-label mb-1 h-7 px-2 text-[10px] font-semibold uppercase tracking-wider",
                  isPriorityGroup && "text-sidebar-foreground/80",
                  isAdminGroup && "text-muted-foreground/70"
                )}
                render={
                  <button
                    type="button"
                    className={cn(
                      "group/section-label flex w-full items-center justify-between rounded-md text-left",
                      "ring-sidebar-ring outline-hidden transition-colors",
                      "hover:bg-sidebar-accent/40 hover:text-sidebar-accent-foreground",
                      "focus-visible:ring-2",
                      "group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:opacity-0"
                    )}
                    onClick={() => toggleSection(group.group, hasActiveItem)}
                    aria-expanded={!isSectionCollapsed}
                  />
                }
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                    "group-data-[collapsible=icon]:hidden",
                    isSectionCollapsed && "-rotate-90"
                  )}
                  aria-hidden
                />
              </SidebarGroupLabel>

              {!isSectionCollapsed && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = ICONS[item.icon as keyof typeof ICONS] ?? LayoutDashboard;
                      const active = isNavItemActive(pathname, item.href);
                      const isPrimary = primaryItemIds.has(item.id);

                      return (
                        <SidebarMenuItem key={`${group.group}-${item.id}`}>
                          <SidebarMenuButton
                            render={<Link href={item.href} />}
                            isActive={active}
                            tooltip={item.label}
                            className={cn(
                              "flow-sidebar-nav-item text-[13px] h-9 relative rounded-[var(--flow-radius-control)]",
                              isPrimary && !active && "flow-sidebar-nav-primary",
                              isAdminGroup && !active && "flow-sidebar-nav-admin",
                              active && "flow-sidebar-nav-active"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75} />
                            <span>{item.label}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
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
