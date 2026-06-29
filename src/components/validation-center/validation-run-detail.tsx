"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { refreshValidationRunAction, listFindingsForRunAction } from "@/app/actions/validation-center";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationFindingsHub } from "@/components/validation-center/validation-findings-hub";
import type { ValidationFinding, ValidationRunView } from "@/lib/validation-center/types";

function artifactLabel(role: string) {
  switch (role) {
    case "output_workbook":
      return "Audit Workbook";
    case "output_pdf":
      return "Executive PDF";
    case "manufacturer_chart":
      return "Manufacturer Chart";
    case "onedrive_export":
      return "OneDrive Export";
    default:
      return role;
  }
}

export function ValidationRunDetail({
  initialRun,
  initialFindings,
}: {
  initialRun: ValidationRunView;
  initialFindings: ValidationFinding[];
}) {
  const [run, setRun] = useState(initialRun);
  const [findings, setFindings] = useState(initialFindings);
  const [refreshing, startRefresh] = useTransition();

  useEffect(() => {
    setRun(initialRun);
    setFindings(initialFindings);
  }, [initialRun, initialFindings]);

  useEffect(() => {
    if (run.status !== "pending" && run.status !== "processing") return;

    const interval = setInterval(() => {
      startRefresh(async () => {
        const updated = await refreshValidationRunAction(run.id);
        if (updated) {
          setRun(updated);
          if (updated.status === "completed") {
            const nextFindings = await listFindingsForRunAction(run.id);
            setFindings(nextFindings);
          }
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [run.id, run.status]);

  const isActive = run.status === "pending" || run.status === "processing";
  const summary = run.run_summary;
  const artifacts = run.files.filter(
    (f) => f.role === "output_workbook" || f.role === "output_pdf"
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge className="capitalize">{run.status}</Badge>
          {isActive && (
            <span className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Processing audit…
            </span>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={refreshing}
            onClick={() =>
            startRefresh(async () => {
              const updated = await refreshValidationRunAction(run.id);
              if (updated) {
                setRun(updated);
                if (updated.status === "completed") {
                  const nextFindings = await listFindingsForRunAction(run.id);
                  setFindings(nextFindings);
                }
              }
            })
          }
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {run.error_message && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">Run failed</CardTitle>
            <CardDescription>{run.error_message}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {run.status === "completed" && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Manufacturer</CardDescription>
              <CardTitle className="text-lg">{run.manufacturer ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Compliance Rate</CardDescription>
              <CardTitle className="text-lg">
                {run.compliance_rate != null ? `${run.compliance_rate}%` : "—"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Needs Review</CardDescription>
              <CardTitle className="text-lg">{summary.needs_review ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Findings Preview</CardDescription>
              <CardTitle className="text-lg">{run.findings_count}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {summary.executive_summary && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Executive Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {summary.executive_summary}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Findings</CardTitle>
          <CardDescription>
            {run.status === "completed"
              ? `${findings.length} issues identified by the audit engine`
              : "Findings appear when processing completes."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {run.status === "completed" ? (
            <ValidationFindingsHub
              initialFindings={findings}
              compact
              runId={run.id}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              {isActive ? "Processing audit…" : "No findings available."}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Artifacts</CardTitle>
          <CardDescription>Download audit outputs generated by the validation engine.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {artifacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isActive ? "Artifacts will appear when processing completes." : "No artifacts available."}
            </p>
          ) : (
            artifacts.map((file) => (
              <div key={file.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">{artifactLabel(file.role)}</p>
                  <p className="text-xs text-muted-foreground">{file.file_name}</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      href={`/api/validation/files/${file.id}`}
                      download={file.file_name}
                    />
                  }
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
