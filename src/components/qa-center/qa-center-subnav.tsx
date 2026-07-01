"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { QA_CENTER_NAV, isQaCenterNavActive } from "@/lib/qa-center/nav";
import { cn } from "@/lib/utils";

export function QaCenterSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="QA Center sections"
      className="flex flex-wrap gap-1 border-b border-border/60 pb-3 mb-6 overflow-x-auto flow-sidebar-scroll"
    >
      {QA_CENTER_NAV.map((item) => {
        const active = isQaCenterNavActive(item.href, pathname);
        return (
          <Link
            key={item.id}
            href={item.href}
            title={item.description}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0",
              active
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
