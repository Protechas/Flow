"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  QA_CENTER_NAV,
  QA_CENTER_WING_LABELS,
  isQaCenterNavActive,
} from "@/lib/qa-center/nav";
import { cn } from "@/lib/utils";

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
  const dashboard = QA_CENTER_NAV.find((i) => i.wing === null);
  const wings = (["review", "audit"] as const).map((wing) => ({
    wing,
    items: QA_CENTER_NAV.filter((i) => i.wing === wing),
  }));

  return (
    <nav
      aria-label="QA Center sections"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 pb-3 mb-6 overflow-x-auto flow-sidebar-scroll"
    >
      {dashboard && (
        <NavPill
          href={dashboard.href}
          label={dashboard.label}
          description={dashboard.description}
          active={isQaCenterNavActive(dashboard.href, pathname)}
        />
      )}
      {wings.map(({ wing, items }) => (
        <div key={wing} className="flex items-center gap-1">
          <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            {QA_CENTER_WING_LABELS[wing]}
          </span>
          {items.map((item) => (
            <NavPill
              key={item.id}
              href={item.href}
              label={item.label}
              description={item.description}
              active={isQaCenterNavActive(item.href, pathname)}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
