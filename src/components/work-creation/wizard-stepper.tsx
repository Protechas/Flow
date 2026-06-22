export function WizardStepper({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="mb-4 space-y-2">
      <div className="overflow-x-auto overscroll-x-contain pb-1 -mx-0.5 px-0.5">
        <div className="flex w-max min-w-full items-center gap-1 sm:gap-2">
          {steps.map((label, i) => {
            const active = i === current;
            const done = i < current;
            return (
              <div key={`${label}-${i}`} className="flex shrink-0 items-center gap-1.5">
                <div
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
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
                    "hidden text-xs whitespace-nowrap lg:inline",
                    active ? "font-medium text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <div
                    className="mx-0.5 hidden h-px w-4 shrink-0 bg-border/60 sm:block lg:w-6"
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
