export function WizardStepper({
  steps,
  current,
  compact = false,
}: {
  steps: string[];
  current: number;
  /** Shorter labels on medium screens when many steps. */
  compact?: boolean;
}) {
  return (
    <div className={compact ? "mb-3 space-y-1.5" : "mb-4 space-y-2"}>
      <div className="overflow-x-auto overscroll-x-contain pb-1 -mx-0.5 px-0.5">
        <div className="flex w-max min-w-full items-center gap-1 sm:gap-1.5">
          {steps.map((label, i) => {
            const active = i === current;
            const done = i < current;
            const shortLabel = compact
              ? label.split(" ")[0]
              : label;
            return (
              <div key={`${label}-${i}`} className="flex shrink-0 items-center gap-1">
                <div
                  className={[
                    "flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full border text-[10px] sm:text-xs font-semibold",
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
                    compact
                      ? "hidden text-[10px] whitespace-nowrap sm:inline md:hidden lg:inline"
                      : "hidden text-xs whitespace-nowrap lg:inline",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                  title={label}
                >
                  {compact ? shortLabel : label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className="mx-0.5 hidden h-px w-3 shrink-0 bg-border/60 sm:block md:w-4 lg:w-5"
                    aria-hidden
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground lg:hidden">
        Step {current + 1} of {steps.length}:{" "}
        <span className="font-medium text-foreground">{steps[current]}</span>
      </p>
    </div>
  );
}
