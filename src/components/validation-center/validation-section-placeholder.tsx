import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/platform";
import { Button } from "@/components/ui/button";

export function ValidationSectionPlaceholder({
  icon: Icon,
  title,
  description,
  phase,
  actionHref,
  actionLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  phase: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <EmptyState
      icon={Icon}
      title={title}
      description={`${description} Coming in ${phase}.`}
      action={
        actionHref && actionLabel ? (
          <Button render={<Link href={actionHref} />}>{actionLabel}</Button>
        ) : undefined
      }
    />
  );
}
