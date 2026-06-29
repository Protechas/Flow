"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiStrip } from "@/components/platform";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EMPTY_BATCH_STATE,
  fileKey,
  getRunnableRows,
  isExcelUpload,
  validateBatchImport,
  type BatchImportRow,
  type BatchImportState,
  type BatchRowStatus,
  type BatchValidationResult,
  type PossibleMatchSuggestion,
} from "@/lib/validation-center/batch-import-engine";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  Play,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusVariant(status: BatchRowStatus) {
  switch (status) {
    case "ready":
      return "secondary" as const;
    case "waiting_for_chart":
    case "waiting_for_export":
      return "outline" as const;
    case "duplicate":
      return "destructive" as const;
    case "needs_review":
    case "unknown":
    case "possible_match":
      return "outline" as const;
    default:
      return "outline" as const;
  }
}

function confidenceTone(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 98) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 85) return "text-primary";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export function ValidationBatchImport({
  files,
  onFilesChange,
  onRunAudits,
  running,
  runProgress,
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
  onRunAudits: (rows: BatchImportRow[], includeReview: boolean) => void;
  running?: boolean;
  runProgress?: { current: number; total: number; label: string } | null;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [validated, setValidated] = useState(false);
  const [importState, setImportState] = useState<BatchImportState>(EMPTY_BATCH_STATE);
  const [confirmedResult, setConfirmedResult] = useState<BatchValidationResult | null>(null);
  const [includeReviewOnRun, setIncludeReviewOnRun] = useState(false);
  const [, startTransition] = useTransition();

  const liveResult = useMemo(
    () => validateBatchImport(files, importState),
    [files, importState]
  );

  const displayResult = validated && confirmedResult ? confirmedResult : liveResult;

  useEffect(() => {
    if (files.length === 0) {
      setValidated(false);
      setConfirmedResult(null);
      return;
    }
    setAnalyzing(true);
    const t = window.setTimeout(() => setAnalyzing(false), 180);
    return () => window.clearTimeout(t);
  }, [files, importState]);

  useEffect(() => {
    setValidated(false);
    setConfirmedResult(null);
  }, [files.length]);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const incoming = Array.from(list);
      if (incoming.length === 0) return;
      const byKey = new Map(files.map((f) => [fileKey(f), f]));
      for (const file of incoming) {
        if (isExcelUpload(file)) byKey.set(fileKey(file), file);
      }
      onFilesChange([...byKey.values()]);
    },
    [files, onFilesChange]
  );

  function validateBatch() {
    startTransition(() => {
      const result = validateBatchImport(files, importState);
      setConfirmedResult(result);
      setValidated(true);
    });
  }

  function setDuplicateSelection(groupId: string, selectedKey: string) {
    setImportState((prev) => ({
      ...prev,
      duplicateSelections: { ...prev.duplicateSelections, [groupId]: selectedKey },
    }));
    setValidated(false);
  }

  function setPossibleMatchAction(matchId: string, action: "paired" | "ignored") {
    setImportState((prev) => ({
      ...prev,
      possibleMatchActions: { ...prev.possibleMatchActions, [matchId]: action },
    }));
    setValidated(false);
  }

  function toggleForceRun(rowId: string) {
    setImportState((prev) => {
      const set = new Set(prev.forceRunRowIds);
      if (set.has(rowId)) set.delete(rowId);
      else set.add(rowId);
      return { ...prev, forceRunRowIds: [...set] };
    });
  }

  function removeFile(key: string) {
    onFilesChange(files.filter((f) => fileKey(f) !== key));
  }

  const runnable = getRunnableRows(displayResult, includeReviewOnRun);
  const pendingPossible = displayResult.possibleMatches.filter((p) => p.resolution === "pending");

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!running) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!running && e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "relative flow-upload-zone p-10 text-center min-h-[180px] flex flex-col items-center justify-center transition-all",
          dragOver && "flow-upload-zone-active",
          running && "opacity-50 pointer-events-none",
          files.length > 0 && "border-primary/20"
        )}
      >
        {analyzing ? (
          <Loader2 className="h-8 w-8 text-primary mb-3 animate-spin" />
        ) : (
          <Upload className="h-8 w-8 text-muted-foreground mb-3" />
        )}
        <p className="text-base font-medium">
          {files.length > 0
            ? `${files.length} file${files.length === 1 ? "" : "s"} loaded`
            : "Drop manufacturer charts and OneDrive exports"}
        </p>
        <p className="flow-helper mt-1.5 max-w-lg mx-auto">
          Drag 1 or 100+ Excel files — Flow discovers, normalizes, and pairs automatically.
          {analyzing && " Analyzing filenames…"}
        </p>
        <input
          type="file"
          multiple
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={running}
          className="absolute inset-0 opacity-0 cursor-pointer"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => onFilesChange([])} disabled={running}>
            Clear all
          </Button>
        </div>
      )}

      {/* Executive summary */}
      {files.length > 0 && (
        <KpiStrip
          columns={6}
          items={[
            { label: "Manufacturers", value: displayResult.summary.manufacturersDetected },
            { label: "Ready", value: displayResult.summary.ready, sublabel: "Auto-paired" },
            {
              label: "Waiting",
              value: displayResult.summary.waiting,
              warn: displayResult.summary.waiting > 0,
            },
            {
              label: "Duplicates",
              value: displayResult.summary.duplicates,
              warn: displayResult.summary.duplicates > 0,
            },
            {
              label: "Needs Review",
              value: displayResult.summary.needsReview,
              warn: displayResult.summary.needsReview > 0,
            },
            {
              label: "Avg Confidence",
              value:
                displayResult.summary.confidenceAverage != null
                  ? `${displayResult.summary.confidenceAverage}%`
                  : "—",
            },
          ]}
        />
      )}

      {/* Pre-validation warnings */}
      {files.length > 0 && !validated && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div>
            <p className="font-medium">Pre-audit preview</p>
            <p className="text-muted-foreground mt-0.5">
              {displayResult.summary.missingExport > 0 &&
                `${displayResult.summary.missingExport} missing export · `}
              {displayResult.summary.missingChart > 0 &&
                `${displayResult.summary.missingChart} missing chart · `}
              {displayResult.summary.possibleMatches > 0 &&
                `${displayResult.summary.possibleMatches} possible match${displayResult.summary.possibleMatches === 1 ? "" : "es"} · `}
              {displayResult.summary.invalidFiles > 0 &&
                `${displayResult.summary.invalidFiles} invalid file${displayResult.summary.invalidFiles === 1 ? "" : "s"}`}
              {displayResult.summary.missingExport === 0 &&
                displayResult.summary.missingChart === 0 &&
                displayResult.summary.possibleMatches === 0 &&
                displayResult.summary.invalidFiles === 0 &&
                "No blocking issues detected — validate to confirm the audit queue."}
            </p>
          </div>
        </div>
      )}

      {validated && confirmedResult && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <p className="font-medium">Batch validated</p>
            <p className="text-muted-foreground mt-0.5">
              {confirmedResult.summary.ready} audit{confirmedResult.summary.ready === 1 ? "" : "s"}{" "}
              ready to run
              {confirmedResult.summary.needsReview > 0 &&
                ` · ${confirmedResult.summary.needsReview} need review`}
            </p>
          </div>
        </div>
      )}

      {/* Possible matches */}
      {pendingPossible.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Possible matches</h3>
          {pendingPossible.map((match) => (
            <PossibleMatchCard
              key={match.id}
              match={match}
              disabled={running}
              onPair={() => setPossibleMatchAction(match.id, "paired")}
              onIgnore={() => setPossibleMatchAction(match.id, "ignored")}
            />
          ))}
        </section>
      )}

      {/* Duplicate groups */}
      {displayResult.duplicateGroups.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Duplicate files</h3>
          {displayResult.duplicateGroups.map((group) => (
            <div key={group.id} className="rounded-lg border bg-muted/20 p-3 space-y-2">
              <p className="text-sm font-medium">
                {group.manufacturer} ·{" "}
                {group.kind === "manufacturer_chart" ? "Chart" : "Export"} · {group.files.length}{" "}
                versions
              </p>
              <div className="flex flex-wrap gap-2">
                {group.files.map((ref) => (
                  <Button
                    key={ref.fileKey}
                    type="button"
                    size="sm"
                    variant={group.selectedFileKey === ref.fileKey ? "default" : "outline"}
                    className="h-8 text-xs"
                    disabled={running}
                    onClick={() => setDuplicateSelection(group.id, ref.fileKey)}
                  >
                    {ref.file.name}
                    {group.selectedFileKey === ref.fileKey && " ✓"}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Default: newest file selected. Click to choose a different version.
              </p>
            </div>
          ))}
        </section>
      )}

      {/* Status grid */}
      {displayResult.rows.length > 0 && (
        <div className="enterprise-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between gap-2">
            <p className="enterprise-label normal-case tracking-normal">Import status</p>
            {validated && (
              <Badge variant="secondary" className="text-xs">
                Validated
              </Badge>
            )}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Manufacturer</TableHead>
                  <TableHead>Chart</TableHead>
                  <TableHead>OneDrive Export</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issues</TableHead>
                  <TableHead className="text-right">Confidence</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayResult.rows.map((row) => (
                  <BatchRowView
                    key={row.id}
                    row={row}
                    disabled={running}
                    onRemoveFile={removeFile}
                    onForceRun={() => toggleForceRun(row.id)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {displayResult.invalidFiles.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive mb-1">Invalid files skipped</p>
          <ul className="text-muted-foreground space-y-1">
            {displayResult.invalidFiles.map((f) => (
              <li key={f.fileKey}>· {f.file.name}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={validateBatch}
            disabled={running || files.length === 0}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Validate Batch
          </Button>

          <Button
            type="button"
            onClick={() => onRunAudits(runnable, includeReviewOnRun)}
            disabled={running || !validated || runnable.length === 0}
          >
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {runProgress
                  ? `Running ${runProgress.current}/${runProgress.total}…`
                  : "Starting…"}
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run {runnable.length} Audit{runnable.length === 1 ? "" : "s"}
              </>
            )}
          </Button>

          {validated && displayResult.summary.needsReview > 0 && (
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeReviewOnRun}
                onChange={(e) => setIncludeReviewOnRun(e.target.checked)}
                className="rounded border-border"
              />
              Include review items ({displayResult.summary.needsReview})
            </label>
          )}

          {!validated && files.length > 0 && (
            <p className="text-xs text-muted-foreground">Validate batch before running audits</p>
          )}
        </div>
      )}

      {runProgress && (
        <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          <span>
            Starting audit {runProgress.current} of {runProgress.total}
            {runProgress.label ? ` — ${runProgress.label}` : ""}
            {runProgress.label ? ` — ${runProgress.label}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function PossibleMatchCard({
  match,
  disabled,
  onPair,
  onIgnore,
}: {
  match: PossibleMatchSuggestion;
  disabled?: boolean;
  onPair: () => void;
  onIgnore: () => void;
}) {
  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Possible match</p>
        <Badge variant="outline" className={confidenceTone(match.confidence)}>
          {match.confidence}% · {match.confidence >= 85 ? "Strong" : "Review suggested"}
        </Badge>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Chart</p>
          <p className="truncate" title={match.mcFile.name}>
            {match.mcFile.name}
          </p>
          <p className="text-xs text-muted-foreground">{match.mcManufacturer}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Export</p>
          <p className="truncate" title={match.exportFile.name}>
            {match.exportFile.name}
          </p>
          <p className="text-xs text-muted-foreground">{match.exportManufacturer}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8" disabled={disabled} onClick={onPair}>
          Pair automatically
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" disabled={disabled} onClick={onIgnore}>
          Ignore
        </Button>
      </div>
    </div>
  );
}

function BatchRowView({
  row,
  disabled,
  onRemoveFile,
  onForceRun,
}: {
  row: BatchImportRow;
  disabled?: boolean;
  onRemoveFile: (key: string) => void;
  onForceRun: () => void;
}) {
  return (
    <TableRow>
      <TableCell className="font-medium whitespace-nowrap">{row.manufacturer}</TableCell>
      <TableCell>
        <FileCell file={row.mcFile} fileKey={row.mcFileKey} onRemove={onRemoveFile} disabled={disabled} />
      </TableCell>
      <TableCell>
        <FileCell file={row.exportFile} fileKey={row.exportFileKey} onRemove={onRemoveFile} disabled={disabled} />
      </TableCell>
      <TableCell>
        <Badge variant={statusVariant(row.status)}>{row.statusLabel}</Badge>
      </TableCell>
      <TableCell className="max-w-[180px]">
        {row.issues.length > 0 ? (
          <span className="text-xs text-muted-foreground line-clamp-2">{row.issues.join(" · ")}</span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className={cn("text-right tabular-nums text-sm", confidenceTone(row.confidence))}>
        {row.confidence != null ? `${row.confidence}%` : "—"}
      </TableCell>
      <TableCell className="text-right">
        {row.status === "needs_review" && row.mcFile && row.exportFile && (
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" disabled={disabled} onClick={onForceRun}>
            {row.forceRun ? "Included" : "Force run"}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function FileCell({
  file,
  fileKey: key,
  onRemove,
  disabled,
}: {
  file: File | null;
  fileKey: string | null;
  onRemove: (key: string) => void;
  disabled?: boolean;
}) {
  if (!file || !key) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-2 max-w-[200px]">
      <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="truncate text-sm" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">{formatFileSize(file.size)}</p>
      </div>
      {!disabled && (
        <button
          type="button"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => onRemove(key)}
          aria-label={`Remove ${file.name}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function rowsToAuditPairs(rows: BatchImportRow[]) {
  return rows.filter((r) => r.mcFile && r.exportFile);
}
