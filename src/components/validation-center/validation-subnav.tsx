"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  VALIDATION_CENTER_NAV,
  isValidationNavActive,
} from "@/lib/validation-center/nav";
import { cn } from "@/lib/utils";

export function ValidationSubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Validation Center sections"
      className="flex flex-wrap gap-1 border-b border-border/60 pb-3 mb-6"
    >
      {VALIDATION_CENTER_NAV.map((item) => {
        const active = isValidationNavActive(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
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
