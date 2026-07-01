"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { submitDocumentsForValidationAction } from "@/app/actions/qa-center";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFlowToast } from "@/components/ui/flow-toast";
import { QA_KNOWLEDGE_ACCEPTED_EXTENSIONS } from "@/lib/qa-center/knowledge/catalog";
import type { QaDocumentValidation, QaValidationIssue } from "@/lib/qa-center/types";
import type { SmartReviewMeta } from "@/lib/qa-center/smart-review/engine";
import {
  clientQaKnowledgeMaxBytes,
  formatUploadLimitLabel,
} from "@/lib/files/upload-limits-client";
import { cn } from "@/lib/utils";
import { ChevronRight, FileUp, FolderUp, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

function parseSmartReview(raw: Record<string, unknown>): SmartReviewMeta | null {
  if (raw.method !== "knowledge_heuristic" || raw.status !== "completed") return null;
  return raw as unknown as SmartReviewMeta;
}

function verdictVariant(v: QaDocumentValidation["verdict"]) {
  switch (v) {
    case "pass":
      return "secondary" as const;
    case "warning":
      return "outline" as const;
    case "fail":
      return "destructive" as const;
    case "critical":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function severityVariant(severity: QaValidationIssue["severity"]) {
  switch (severity) {
    case "critical":
    case "high":
      return "destructive" as const;
    case "medium":
      return "outline" as const;
    default:
      return "secondary" as const;
  }
}

export function UploadQueueView({
  validations,
  canSubmit,
}: {
  validations: QaDocumentValidation[];
  canSubmit: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [manufacturer, setManufacturer] = useState("");
  const [selectedValidation, setSelectedValidation] = useState<QaDocumentValidation | null>(null);

  const hasPendingValidations = useMemo(
    () => validations.some((v) => v.status === "queued" || v.status === "processing"),
    [validations]
  );

  useEffect(() => {
    if (!hasPendingValidations) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [hasPendingValidations, router]);

  const onPickFiles = useCallback((fileList: FileList | File[]) => {
    setSelectedFiles((prev) => [...prev, ...Array.from(fileList)]);
  }, []);

  const handleSubmit = useCallback(() => {
    if (selectedFiles.length === 0) {
      toast({ variant: "error", title: "No files", description: "Add files to validate." });
      return;
    }

    const fd = new FormData();
    for (const file of selectedFiles) fd.append("files", file);
    if (manufacturer.trim()) fd.set("manufacturer", manufacturer.trim());

    startTransition(async () => {
      const res = await submitDocumentsForValidationAction(fd);
      if (!res.ok) {
        toast({ variant: "error", title: "Validation failed", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: "Files queued",
        description: `${res.submitted} file(s) queued for validation. Results appear shortly — refresh if needed.`,
      });
      setSelectedFiles([]);
      setManufacturer("");
      router.refresh();
    });
  }, [manufacturer, router, selectedFiles, toast]);

  return (
    <>
      <QaCenterSubnav />

      <div className="mb-6">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload & Validate
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl mt-1">
          Submit SI documents for layered validation against the Knowledge Library — file checks,
          MCC verification, SOP compliance, and knowledge-backed smart review before human QA.
        </p>
      </div>

      {canSubmit && (
        <div className="enterprise-panel p-4 mb-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="mfr-hint">Manufacturer (optional)</Label>
                <Input
                  id="mfr-hint"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  placeholder="e.g. Toyota"
                />
              </div>
              {selectedFiles.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1 max-h-24 overflow-y-auto">
                  {selectedFiles.map((f) => (
                    <p key={`${f.name}-${f.size}`}>{f.name}</p>
                  ))}
                </div>
              )}
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center min-w-[220px] transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border/60"
              )}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onPickFiles(e.dataTransfer.files);
              }}
            >
              <div className="flex justify-center gap-3 text-muted-foreground mb-2">
                <FileUp className="h-8 w-8" />
                <FolderUp className="h-8 w-8" />
              </div>
              <p className="text-sm font-medium">Drop files here</p>
              <p className="text-xs text-muted-foreground mt-1">
                {QA_KNOWLEDGE_ACCEPTED_EXTENSIONS.join(" · ")}
              </p>
              <label className="inline-block mt-3">
                <Button size="sm" variant="outline" type="button" render={<span />}>
                  Browse files
                </Button>
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  accept={QA_KNOWLEDGE_ACCEPTED_EXTENSIONS.join(",")}
                  onChange={(e) => e.target.files && onPickFiles(e.target.files)}
                />
              </label>
              <p className="text-[10px] text-muted-foreground mt-2">
                Max {formatUploadLimitLabel(clientQaKnowledgeMaxBytes)} per file
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSubmit} disabled={pending || selectedFiles.length === 0}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Validate {selectedFiles.length > 0 ? `${selectedFiles.length} file(s)` : ""}
            </Button>
            {selectedFiles.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedFiles([])}
                disabled={pending}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="enterprise-panel overflow-hidden">
        <div className="px-4 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold">Validation queue</h3>
          <p className="text-xs text-muted-foreground">
            {validations.length} recent submissions
            {hasPendingValidations ? " · auto-refreshing while processing" : ""}
          </p>
        </div>
        {validations.length === 0 ? (
          <p className="text-sm text-muted-foreground p-8 text-center">
            No documents validated yet. Upload files above to run pre-QA checks.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Document</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="text-right">Issues</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {validations.map((v) => (
                <TableRow
                  key={v.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setSelectedValidation(v)}
                >
                  <TableCell className="font-medium max-w-[200px] truncate">{v.file_name}</TableCell>
                  <TableCell>{v.manufacturer ?? "—"}</TableCell>
                  <TableCell className="capitalize">{v.status}</TableCell>
                  <TableCell>{v.qa_score != null ? `${v.qa_score}%` : "—"}</TableCell>
                  <TableCell>
                    {v.verdict ? (
                      <Badge variant={verdictVariant(v.verdict)} className="capitalize">
                        {v.verdict}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right">{v.issues.length || "—"}</TableCell>
                  <TableCell>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Sheet
        open={selectedValidation != null}
        onOpenChange={(open) => !open && setSelectedValidation(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedValidation && (
            <>
              <SheetHeader>
                <SheetTitle className="truncate pr-6">{selectedValidation.file_name}</SheetTitle>
                <SheetDescription>
                  {selectedValidation.manufacturer ?? "Unknown manufacturer"} ·{" "}
                  {selectedValidation.status}
                  {selectedValidation.qa_score != null && ` · Score ${selectedValidation.qa_score}%`}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex flex-wrap gap-2">
                  {selectedValidation.verdict && (
                    <Badge variant={verdictVariant(selectedValidation.verdict)} className="capitalize">
                      {selectedValidation.verdict}
                    </Badge>
                  )}
                  {selectedValidation.estimated_review_minutes != null && (
                    <Badge variant="outline">
                      ~{selectedValidation.estimated_review_minutes} min review
                    </Badge>
                  )}
                  {selectedValidation.confidence_pct != null && (
                    <Badge variant="outline">{selectedValidation.confidence_pct}% confidence</Badge>
                  )}
                </div>

                {(() => {
                  const smart = parseSmartReview(selectedValidation.ai_review ?? {});
                  if (!smart) return null;
                  return (
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-semibold">Smart review</h4>
                        <Badge variant="outline" className="text-[10px]">
                          Library heuristics
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{smart.summary}</p>
                      <p className="text-xs">
                        {smart.checks_passed}/{smart.checks_run} checks passed
                        {smart.reference_docs_used > 0
                          ? ` · ${smart.reference_docs_used} reference doc(s)`
                          : ""}
                      </p>
                      {smart.signals.length > 0 && (
                        <ul className="text-xs space-y-1">
                          {smart.signals.map((s) => (
                            <li key={s.id} className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 h-1.5 w-1.5 rounded-full shrink-0",
                                  s.passed ? "bg-emerald-500" : "bg-amber-500"
                                )}
                              />
                              <span>
                                <span className="font-medium">{s.label}</span>
                                {" — "}
                                {s.detail}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })()}

                {selectedValidation.status === "failed" && (
                  <Button size="sm" variant="outline" render={<Link href="/qa-center/review" />}>
                    Send to review queue
                  </Button>
                )}
                {(selectedValidation.verdict === "fail" ||
                  selectedValidation.verdict === "critical") && (
                  <Button size="sm" variant="outline" render={<Link href="/qa-center/review" />}>
                    Open review queue
                  </Button>
                )}

                {selectedValidation.issues.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {selectedValidation.status === "completed"
                      ? "No issues found — document passed validation checks."
                      : "Validation still running or no results yet."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold">
                      Issues ({selectedValidation.issues.length})
                    </h4>
                    {selectedValidation.issues.map((issue) => (
                      <div key={issue.id} className="rounded-lg border p-3 space-y-2 text-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{issue.rule_violated}</p>
                          <Badge variant={severityVariant(issue.severity)} className="capitalize shrink-0">
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-muted-foreground">{issue.why_failed}</p>
                        {issue.evidence && (
                          <p className="text-xs bg-muted/40 rounded p-2 font-mono">{issue.evidence}</p>
                        )}
                        {issue.suggested_fix && (
                          <p className="text-xs">
                            <span className="font-medium">Suggested fix: </span>
                            {issue.suggested_fix}
                          </p>
                        )}
                        {issue.ai_explanation && (
                          <p className="text-xs text-muted-foreground italic">
                            Smart review ({issue.ai_confidence ?? "—"}% confidence):{" "}
                            {issue.ai_explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
