"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCosmeticsAction } from "@/app/actions/cosmetics";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFlowToast } from "@/components/ui/flow-toast";
import type { BadgeState } from "@/lib/badges/badge-types";
import {
  COSMETIC_ACCENTS,
  COSMETIC_FRAMES,
} from "@/lib/badges/cosmetic-types";
import { cn } from "@/lib/utils";
import { Lock, Paintbrush } from "lucide-react";

export interface CosmeticsState {
  frame: string | null;
  title: string | null;
  accent: string | null;
}

function OptionChip({
  selected,
  locked,
  onClick,
  children,
  hint,
}: {
  selected: boolean;
  locked: boolean;
  onClick: () => void;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onClick}
      title={hint}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        selected && "border-primary bg-primary/10 text-foreground",
        !selected && !locked && "border-border/60 text-muted-foreground hover:border-primary/40",
        locked && "cursor-not-allowed border-border/30 text-muted-foreground/40"
      )}
    >
      {locked && <Lock className="h-3 w-3" />}
      {children}
    </button>
  );
}

export function CustomizeDialog({
  badges,
  cosmetics,
}: {
  badges: BadgeState[];
  cosmetics: CosmeticsState;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [frame, setFrame] = useState(cosmetics.frame);
  const [title, setTitle] = useState(cosmetics.title);
  const [accent, setAccent] = useState(cosmetics.accent);

  const earned = badges.filter((b) => b.earned);
  const earnedCount = earned.length;

  function save() {
    startTransition(async () => {
      const res = await setCosmeticsAction({ frame, title, accent });
      if (!res.ok) {
        toast({ variant: "error", title: "Could not save", description: res.message });
        return;
      }
      toast({ variant: "success", title: "Look updated" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Paintbrush className="h-3 w-3" />
        Customize
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Paintbrush className="h-4 w-4 text-primary" />
              Customize your look
            </DialogTitle>
            <DialogDescription>
              Unlock more by earning badges — you have {earnedCount}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Avatar frame
              </p>
              <div className="flex flex-wrap gap-1.5">
                <OptionChip selected={frame === null} locked={false} onClick={() => setFrame(null)}>
                  None
                </OptionChip>
                {COSMETIC_FRAMES.map((f) => {
                  const locked = earnedCount < f.unlockCount;
                  return (
                    <OptionChip
                      key={f.id}
                      selected={frame === f.id}
                      locked={locked}
                      onClick={() => setFrame(f.id)}
                      hint={locked ? `Unlocks at ${f.unlockCount} badges` : undefined}
                    >
                      <span
                        className={cn("inline-block h-4 w-4 rounded-full bg-card", f.className)}
                      />
                      {f.label}
                      {locked && <span className="opacity-70">({f.unlockCount})</span>}
                    </OptionChip>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Title — wear a badge you&apos;ve earned
              </p>
              <div className="flex flex-wrap gap-1.5">
                <OptionChip selected={title === null} locked={false} onClick={() => setTitle(null)}>
                  None
                </OptionChip>
                {badges.map((b) => (
                  <OptionChip
                    key={b.id}
                    selected={title === b.name}
                    locked={!b.earned}
                    onClick={() => setTitle(b.name)}
                    hint={!b.earned ? `Earn "${b.name}" first` : undefined}
                  >
                    {b.name}
                  </OptionChip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Workspace accent
              </p>
              <div className="flex flex-wrap gap-1.5">
                <OptionChip selected={accent === null} locked={false} onClick={() => setAccent(null)}>
                  <span className="inline-block h-4 w-4 rounded-full" style={{ background: "#5b7cff" }} />
                  Nebula (default)
                </OptionChip>
                {COSMETIC_ACCENTS.map((a) => {
                  const locked = earnedCount < a.unlockCount;
                  return (
                    <OptionChip
                      key={a.id}
                      selected={accent === a.id}
                      locked={locked}
                      onClick={() => setAccent(a.id)}
                      hint={locked ? `Unlocks at ${a.unlockCount} badges` : undefined}
                    >
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ background: a.value }}
                      />
                      {a.label}
                      {locked && <span className="opacity-70">({a.unlockCount})</span>}
                    </OptionChip>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              Save look
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
