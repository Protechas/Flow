import { cn } from "@/lib/utils";

export function FlowScoreRing({
  score,
  size = "md",
  className,
}: {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dim = size === "lg" ? 120 : size === "sm" ? 56 : 88;
  const stroke = size === "lg" ? 8 : 6;
  const r = (dim - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        <circle
          cx={dim / 2}
          cy={dim / 2}
          r={r}
          fill="none"
          stroke="url(#flowScoreGrad)"
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id="flowScoreGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(262 83% 58%)" />
            <stop offset="100%" stopColor="hsl(239 84% 67%)" />
          </linearGradient>
        </defs>
      </svg>
      <span
        className={cn(
          "absolute font-bold tabular-nums text-violet-400",
          size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-2xl"
        )}
      >
        {score}
      </span>
    </div>
  );
}
