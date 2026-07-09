"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { GitCompareArrows, ScanSearch, SlidersHorizontal } from "lucide-react";

const TABS = [
  { href: "/qa-center/id3", label: "Compare", icon: GitCompareArrows, exact: true },
  { href: "/qa-center/id3/engine", label: "QA Engine", icon: ScanSearch, exact: false },
  { href: "/qa-center/id3/rules", label: "Rules", icon: SlidersHorizontal, exact: false },
];

/** Sub-navigation inside the ID³ room. */
export function Id3Tabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex items-center gap-1 rounded-lg border border-border/50 bg-muted/20 p-1 w-fit">
      {TABS.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
