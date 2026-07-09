"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createValidationRunAction } from "@/app/actions/validation-center";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFlowToast } from "@/components/ui/flow-toast";
import { FileSpreadsheet, Loader2, Scale, Upload } from "lucide-react";

/** ID3: upload a manufacturer chart + the rules workbook, queue a comparison. */
export function Id3UploadForm() {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [chartName, setChartName] = useState<string | null>(null);
  const [rulesName, setRulesName] = useState<string | null>(null);

  function submit(formData: FormData) {
    formData.set("engine_id", "id3_validation");
    startTransition(async () => {
      const res = await createValidationRunAction(formData);
      if (!res.ok) {
        toast({ variant: "error", title: "Could not start validation", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: "ID³ validation queued",
        description: "The audit worker will process it and results will appear below.",
      });
      formRef.current?.reset();
      setChartName(null);
      setRulesName(null);
      router.refresh();
    });
  }

  return (
    <form ref={formRef} action={submit} className="enterprise-panel space-y-4 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
            Manufacturer chart (Excel)
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
            <Scale className="h-3.5 w-3.5 text-primary" />
            Rules workbook (Excel)
          </Label>
          <Input
            type="file"
            name="onedrive_export"
            accept=".xlsx,.xls,.csv"
            required
            onChange={(e) => setRulesName(e.target.files?.[0]?.name ?? null)}
          />
          {rulesName && <p className="text-xs text-muted-foreground">{rulesName}</p>}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          The chart is compared row-by-row against the rules: coverage gaps, rule mismatches,
          and entries no rule covers — with a downloadable results workbook.
        </p>
        <Button type="submit" disabled={pending} className="shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Run comparison
        </Button>
      </div>
    </form>
  );
}
