"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Layers, Loader2, Upload, User } from "lucide-react";
import { createValidationRunAction } from "@/app/actions/validation-center";
import {
  rowsToAuditPairs,
  ValidationBatchImport,
} from "@/components/validation-center/validation-batch-import";
import { ValidationFileDropzone } from "@/components/validation-center/validation-file-dropzone";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BatchImportRow } from "@/lib/validation-center/batch-import-engine";
import { getValidationEngine } from "@/lib/validation-center/engines/registry";
import type { ValidationEngineId } from "@/lib/validation-center/types";
import { validationPath } from "@/lib/validation-center/nav";
import { cn } from "@/lib/utils";

type UploadMode = "single" | "batch";

export function NewAuditWizard({ engineId }: { engineId: ValidationEngineId }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<UploadMode>("batch");
  const [mcFile, setMcFile] = useState<File | null>(null);
  const [exportFile, setExportFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchProgress, setBatchProgress] = useState<{
    current: number;
    total: number;
    label: string;
  } | null>(null);
  const engine = getValidationEngine(engineId);

  if (!engine || engine.status !== "active") {
    return (
      <p className="text-sm text-muted-foreground">
        This validation engine is not available yet.
      </p>
    );
  }

  function runSingle() {
    if (!mcFile) {
      setError("Manufacturer chart file is required");
      return;
    }
    if (!exportFile) {
      setError("OneDrive export file is required");
      return;
    }
    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("engine_id", engineId);
      formData.set("manufacturer_chart", mcFile);
      formData.set("onedrive_export", exportFile);

      const result = await createValidationRunAction(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(validationPath(`/runs/${result.runId}`));
      router.refresh();
    });
  }

  function runBatch(rows: BatchImportRow[], _includeReview: boolean) {
    const pairs = rowsToAuditPairs(rows);
    if (pairs.length === 0) {
      setError("No ready audit pairs to run.");
      return;
    }
    setError(null);

    startTransition(async () => {
      const started: string[] = [];
      const failed: { manufacturer: string; message: string }[] = [];

      for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        setBatchProgress({
          current: i + 1,
          total: pairs.length,
          label: pair.manufacturer,
        });

        const formData = new FormData();
        formData.set("engine_id", engineId);
        formData.set("manufacturer_chart", pair.mcFile!);
        formData.set("onedrive_export", pair.exportFile!);

        const result = await createValidationRunAction(formData);
        if (result.ok) {
          started.push(result.runId);
        } else {
          failed.push({ manufacturer: pair.manufacturer, message: result.message });
        }
      }

      setBatchProgress(null);

      if (started.length === 0) {
        setError(failed[0]?.message ?? "All batch runs failed");
        return;
      }

      if (failed.length > 0) {
        setError(
          `${started.length} run${started.length === 1 ? "" : "s"} started. ${failed.length} failed: ${failed.map((f) => f.manufacturer).join(", ")}`
        );
      }

      router.push(
        started.length === 1 ? validationPath(`/runs/${started[0]}`) : validationPath("/runs")
      );
      router.refresh();
    });
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Tabs value={mode} onValueChange={(v) => v && setMode(v as UploadMode)}>
        <TabsList>
          <TabsTrigger value="batch" className="gap-1.5">
            <Layers className="h-3.5 w-3.5" />
            Batch import
          </TabsTrigger>
          <TabsTrigger value="single" className="gap-1.5">
            <User className="h-3.5 w-3.5" />
            Single audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="batch" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Intelligent batch import</CardTitle>
              <CardDescription>
                Drop dozens or hundreds of Excel files. Flow normalizes manufacturers, pairs
                charts with exports, detects duplicates, and validates before processing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ValidationBatchImport
                files={batchFiles}
                onFilesChange={setBatchFiles}
                onRunAudits={runBatch}
                running={pending}
                runProgress={batchProgress}
              />

              {error && mode === "batch" && (
                <p
                  className={cn(
                    "text-sm",
                    error.includes("started")
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-destructive"
                  )}
                >
                  {error}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="single" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{engine.label}</CardTitle>
              <CardDescription>
                Drop or browse for one manufacturer chart and matching OneDrive export.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <ValidationFileDropzone
                id="manufacturer_chart"
                name="manufacturer_chart"
                label="Manufacturer Chart (.xlsx)"
                description="Component Manufacturer Chart workbook for one OEM."
                file={mcFile}
                onFileChange={setMcFile}
                disabled={pending}
                required
                status={mcFile ? "ready" : "empty"}
              />
              <ValidationFileDropzone
                id="onedrive_export"
                name="onedrive_export"
                label="OneDrive Export (.xlsx)"
                description="OneDrive file list export for the same OEM."
                file={exportFile}
                onFileChange={setExportFile}
                disabled={pending}
                required
                status={exportFile ? "ready" : "empty"}
              />
              {error && mode === "single" && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              <Button type="button" onClick={runSingle} disabled={pending || !mcFile || !exportFile}>
                {pending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {batchProgress ? `Starting ${batchProgress.label}…` : "Starting audits…"}
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload &amp; Start Audit
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
