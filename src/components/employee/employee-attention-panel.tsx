import Link from "next/link";
import type { EmployeeQueueBlockedItem } from "@/lib/employee/queue";
import type { EmployeeQaReturn, HelpFlagView } from "@/types/flow";
import { AlertTriangle, Clock, LifeBuoy, ShieldAlert } from "lucide-react";

export function EmployeeAttentionPanel({
  qaReturns,
  blocked,
  waitingOnQa,
  openHelpFlags,
}: {
  qaReturns: EmployeeQaReturn[];
  blocked: EmployeeQueueBlockedItem[];
  waitingOnQa: { id: string; title: string }[];
  openHelpFlags: HelpFlagView[];
}) {
  const items: { icon: typeof AlertTriangle; label: string; detail: string; href?: string }[] =
    [];

  for (const item of qaReturns) {
    items.push({
      icon: AlertTriangle,
      label: "Returned work",
      detail: item.package.title,
      href: `/work/${item.package.id}`,
    });
  }

  for (const task of waitingOnQa) {
    items.push({
      icon: ShieldAlert,
      label: "Waiting on QA",
      detail: task.title,
      href: `/work/${task.id}`,
    });
  }

  for (const { task, label } of blocked) {
    items.push({
      icon: Clock,
      label,
      detail: task.title,
      href: `/work/${task.id}`,
    });
  }

  if (openHelpFlags.length > 0) {
    items.push({
      icon: LifeBuoy,
      label: "Help request open",
      detail: `${openHelpFlags.length} request${openHelpFlags.length === 1 ? "" : "s"} in progress`,
    });
  }

  if (items.length === 0) return null;

  return (
    <section className="enterprise-panel border-amber-500/25 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/5">
        <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500">
          Needs Attention
        </h2>
      </div>
      <ul className="divide-y divide-border/60">
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>
            {item.href ? (
              <Link
                href={item.href}
                className="flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <item.icon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.detail}</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">
                <item.icon className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.detail}</p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
