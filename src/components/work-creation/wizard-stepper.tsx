export function WizardStepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={label} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold border",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : done
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground",
              ].join(" ")}
            >
              {i + 1}
            </div>
            <span
              className={[
                "text-xs truncate hidden sm:inline",
                active ? "text-foreground font-medium" : "text-muted-foreground",
              ].join(" ")}
            >
              {label}
            </span>
            {i < steps.length - 1 && (
              <div className="h-px flex-1 bg-border/60 mx-1 hidden sm:block" />
            )}
          </div>
        );
      })}
    </div>
  );
}
