import { Badge } from "@/components/ui/badge";
import {
  SEMANTIC_VARIANT_STYLES,
  type EnterpriseSemanticVariant,
} from "@/lib/design/status-system";
import { cn } from "@/lib/utils";

export function EnterpriseStatusBadge({
  label,
  variant = "neutral",
  showDot = true,
  size = "default",
  className,
}: {
  label: string;
  variant?: EnterpriseSemanticVariant;
  showDot?: boolean;
  size?: "default" | "sm";
  className?: string;
}) {
  const styles = SEMANTIC_VARIANT_STYLES[variant];
  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium gap-1.5 max-w-full rounded-sm",
        size === "sm" && "text-[10px] px-1.5 py-0 h-5",
        styles.badge,
        className
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", styles.dot)} aria-hidden />
      )}
      {label}
    </Badge>
  );
}
