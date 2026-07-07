"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { employeeReopenTaskAction } from "@/app/actions/employee";
import { PriorityBadge } from "@/components/work-tracker/priority-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { EmployeeQaReturn } from "@/types/flow";
import { AlertTriangle, RotateCcw } from "lucide-react";

export function EmployeeQaReturns({ returns }: { returns: EmployeeQaReturn[] }) {
  if (returns.length === 0) return null;

  return (
    <section className="enterprise-panel border-amber-500/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-500/20 bg-amber-500/5">
        <h2 className="flow-section-title flex items-center gap-2 text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          Work returned by QA
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {returns.length} package{returns.length !== 1 ? "s" : ""} need corrections
        </p>
      </div>
      <ul className="divide-y divide-border">
        {returns.map((item) => (
          <QaReturnRow key={item.package.id} item={item} />
        ))}
      </ul>
    </section>
  );
}

function QaReturnRow({ item }: { item: EmployeeQaReturn }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { package: pkg } = item;

  function reopen() {
    startTransition(async () => {
      await employeeReopenTaskAction(pkg.id);
      router.push(`/work/${pkg.id}?autostart=1`);
      router.refresh();
    });
  }

  return (
    <li className="px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{pkg.title}</p>
          <p className="text-xs text-muted-foreground">
            {pkg.project?.name} · {pkg.manufacturer?.name}
          </p>
        </div>
        <PriorityBadge priority={pkg.priority} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div>
          <dt className="text-muted-foreground">Reviewer</dt>
          <dd className="font-medium">{item.reviewerName}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Type</dt>
          <dd className="font-medium">{item.correctionType}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Reason</dt>
          <dd>{item.reason}</dd>
        </div>
        {pkg.due_date && (
          <div>
            <dt className="text-muted-foreground">Due</dt>
            <dd className="font-medium">{pkg.due_date}</dd>
          </div>
        )}
      </dl>
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 h-10"
          disabled={pending}
          onClick={reopen}
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Reopen & fix
        </Button>
        <Link
          href={`/work/${pkg.id}`}
              prefetch={false}
          className={cn(buttonVariants({ size: "sm", variant: "outline" }), "h-10")}
        >
          View
        </Link>
      </div>
    </li>
  );
}
