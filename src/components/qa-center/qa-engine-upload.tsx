"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQaEngineScanAction } from "@/app/actions/qa-engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowToast } from "@/components/ui/flow-toast";
import { FileSpreadsheet, Files, Loader2, ScanSearch } from "lucide-react";

/** Upload files → run checks. Simple by design. */
export function QaEngineUpload() {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [chartName, setChartName] = useState<string | null>(null);
  const [refNames, setRefNames] = useState<string[]>([]);

  function submit(formData: FormData) {
    startTransition(async () => {
      const res = await createQaEngineScanAction(formData);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not start scan", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: "QA scan queued",
        description: "Findings will appear below when the scan completes.",
      });
      formRef.current?.reset();
      setChartName(null);
      setRefNames([]);
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={submit} className="enterprise-panel space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            MC chart (Excel/CSV)
          </Label>
          <Input
            type="file"
            name="manufacturer_chart"
            accept=".xlsx,.xls,.csv"
            required
            onChange={(e) => setChartName(e.target.files?.[0]?.name ?? null)}
          />
          {chartName && <p className="text-xs text-muted-foreground">{chartName}</p>}
        </div>
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Files className="h-3.5 w-3.5 text-primary" />
            Reference files — optional, multiple allowed
          </Label>
          <Input
            type="file"
            name="reference_files"
            accept=".xlsx,.xls,.csv"
            multiple
            onChange={(e) => setRefNames([...(e.target.files ?? [])].map((f) => f.name))}
          />
          {refNames.length > 0 && (
            <p className="text-xs text-muted-foreground">{refNames.join(" · ")}</p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Checks: blanks, duplicates, inconsistent manufacturer names, malformed values,
          conflicting component data, and mismatches between reference files and the MC chart.
        </p>
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="h-4 w-4" />
          )}
          Run checks
        </Button>
      </div>
    </form>
  );
}
