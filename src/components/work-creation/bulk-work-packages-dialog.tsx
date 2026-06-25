"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkCreateWorkPackagesAction } from "@/app/actions/project-structure";
import { WorkPackageBulkPicker } from "@/components/work-creation/work-package-bulk-picker";
import { useFlowToast } from "@/components/ui/flow-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { parseBulkLines } from "@/lib/work-creation/project-structure-types";
import { getSuggestedWorkPackageNames } from "@/lib/work-creation/suggested-work-packages";
import { dedupeSortLabels, sortLabels } from "@/lib/work-creation/sort-labels";
import type { SmartHierarchyLabels } from "@/lib/work-packages/smart-labels";
import { Layers } from "lucide-react";

export function BulkWorkPackagesDialog({
  projectId,
  labels,
  defaultYears,
  projectType,
  trigger,
}: {
  projectId: string;
  labels: SmartHierarchyLabels;
  defaultYears?: number[];
  projectType?: string;
  trigger?: React.ReactElement;
}) {
  const { toast } = useFlowToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>([]);
  const [customNames, setCustomNames] = useState<string[]>([]);
  const [phaseText, setPhaseText] = useState(
    (defaultYears ?? [new Date().getFullYear(), new Date().getFullYear() + 1])
      .map(String)
      .join("\n")
  );

  const suggested = useMemo(
    () =>
      getSuggestedWorkPackageNames({
        projectType,
        structureMode: "by_manufacturer",
      }),
    [projectType]
  );

  const options = useMemo(
    () => dedupeSortLabels([...suggested, ...customNames, ...selected]),
    [suggested, customNames, selected]
  );

  function reset() {
    setSelected([]);
    setCustomNames([]);
    setPhaseText(
      (defaultYears ?? [new Date().getFullYear(), new Date().getFullYear() + 1])
        .map(String)
        .join("\n")
    );
  }

  function submit() {
    if (!selected.length) {
      toast({
        variant: "error",
        title: `Select at least one ${labels.workPackageShort.toLowerCase()}`,
      });
      return;
    }
    const years = parseBulkLines(phaseText)
      .map((l) => parseInt(l, 10))
      .filter((y) => y >= 1990 && y <= 2100);

    startTransition(async () => {
      try {
        await bulkCreateWorkPackagesAction({
          projectId,
          names: selected,
          years: years.length ? years : undefined,
        });
        toast({
          variant: "success",
          title: `${labels.workPackagePlural} created`,
          description: `Added ${selected.length} ${labels.workPackagePlural.toLowerCase()}.`,
        });
        setOpen(false);
        reset();
        router.refresh();
      } catch (e) {
        toast({
          variant: "error",
          title: "Bulk create failed",
          description: e instanceof Error ? e.message : "Something went wrong.",
        });
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button type="button" variant="outline" size="sm" className="h-8">
              <Layers className="h-3.5 w-3.5 mr-1" />
              Bulk add
            </Button>
          )
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk add {labels.workPackagePlural.toLowerCase()}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <WorkPackageBulkPicker
            labels={labels}
            options={options}
            selected={selected}
            customOptions={customNames}
            onSelectedChange={(names) => setSelected(sortLabels(names))}
            onAddCustom={(name) => {
              setCustomNames((prev) =>
                prev.some((n) => n.toLowerCase() === name.toLowerCase())
                  ? prev
                  : [...prev, name]
              );
            }}
            onRemoveCustom={(name) =>
              setCustomNames((prev) =>
                prev.filter((n) => n.toLowerCase() !== name.toLowerCase())
              )
            }
          />
          <div className="space-y-2">
            <Label>{labels.phasePlural} (optional — years, one per line)</Label>
            <Textarea
              value={phaseText}
              onChange={(e) => setPhaseText(e.target.value)}
              placeholder={"2024\n2025\n2026"}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={pending || selected.length === 0}>
            {pending ? "Creating…" : `Create (${selected.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
