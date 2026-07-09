"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  QA_CENTER_NAV,
  QA_CENTER_WING_LABELS,
  isQaCenterNavActive,
} from "@/lib/qa-center/nav";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

function NavPill({
  href,
  label,
  description,
  active,
}: {
  href: string;
  label: string;
  description: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      title={description}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0",
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function QaCenterSubnav() {
  const pathname = usePathname();
  const router = useRouter();
  const topLevel = QA_CENTER_NAV.filter((i) => i.wing === null);
  const wings = (["review", "audit"] as const).map((wing) => ({
    wing,
    items: QA_CENTER_NAV.filter((i) => i.wing === wing),
  }));

  return (
    <nav
      aria-label="QA Center sections"
      className="flex flex-wrap items-center gap-1.5 border-b border-border/60 pb-3 mb-6"
    >
      {topLevel.map((item) => (
        <NavPill
          key={item.id}
          href={item.href}
          label={item.label}
          description={item.description}
          active={isQaCenterNavActive(item.href, pathname)}
        />
      ))}
      {wings.map(({ wing, items }) => {
        const activeItem = items.find((i) => isQaCenterNavActive(i.href, pathname));
        return (
          <DropdownMenu key={wing}>
            <DropdownMenuTrigger
              className={cn(
                "flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
                activeItem
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              {QA_CENTER_WING_LABELS[wing]}
              {activeItem && (
                <span className="max-w-36 truncate text-xs font-normal opacity-80">
                  · {activeItem.label}
                </span>
              )}
              <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {items.map((item) => {
                const active = isQaCenterNavActive(item.href, pathname);
                return (
                  <DropdownMenuItem
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="flex w-full items-center gap-1.5 text-sm font-medium">
                      {item.label}
                      {active && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                    </span>
                    <span className="text-xs text-muted-foreground">{item.description}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}
