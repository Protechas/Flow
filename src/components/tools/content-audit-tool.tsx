"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  eddyModelReportAction,
  eddyReviewContentAction,
  logContentAuditRunAction,
  saveModelReportAction,
} from "@/app/actions/content-checks";
import type { AuditHistorySummary } from "@/lib/content-checks/audit-runs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EddyContentReview, EddyModelReport } from "@/lib/ai/content-review";
import {
  analyzeModelCoverage,
  runContentChecksOnSet,
  type CheckFlag,
  type ContentCheckResult,
  type ExtractedDoc,
  type LogicalDocResult,
  type ModelCoverage,
} from "@/lib/content-checks/engine";
import { extractDocInBrowser } from "@/lib/content-checks/extract-browser";
import { DEFAULT_CONTENT_RULES } from "@/lib/content-checks/rules";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  EyeOff,
  FileWarning,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";

interface AuditRow {
  fileName: string;
  partFiles: string[];
  partCount: number;
  sizeKb: number;
  pages: number;
  result: ContentCheckResult;
  eddy?: EddyContentReview | null;
  eddyPending?: boolean;
  eddyError?: string | null;
}

function severityRank(flags: CheckFlag[]): number {
  if (flags.some((f) => f.severity === "fail")) return 0;
  if (flags.some((f) => f.severity === "warn")) return 1;
  return 2;
}

function verdictBadge(row: AuditRow) {
  if (row.result.verdict === "unreadable")
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <EyeOff className="mr-1 h-3 w-3" />
        Unreadable
      </Badge>
    );
  if (row.result.verdict === "pass")
    return (
      <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Pass
      </Badge>
    );
  const fails = row.result.flags.filter((f) => f.severity === "fail").length;
  return (
    <Badge
      variant="outline"
      className={fails > 0 ? "text-red-400 border-red-500/30" : "text-amber-400 border-amber-500/30"}
    >
      <AlertTriangle className="mr-1 h-3 w-3" />
      {row.result.flags.length} flag{row.result.flags.length === 1 ? "" : "s"}
    </Badge>
  );
}

/** Walk dropped items (files AND folders) into a flat file list — the drop
 * zone should swallow an entire model folder, subfolders included. */
async function collectDroppedFiles(dataTransfer: DataTransfer): Promise<File[]> {
  const out: File[] = [];

  async function readAll(dir: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
    const reader = dir.createReader();
    const all: FileSystemEntry[] = [];
    // readEntries returns batches of ≤100; keep calling until empty.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
      );
      if (batch.length === 0) return all;
      all.push(...batch);
    }
  }

  async function walk(entry: FileSystemEntry): Promise<void> {
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) =>
        (entry as FileSystemFileEntry).file(resolve, reject)
      );
      out.push(file);
    } else if (entry.isDirectory) {
      for (const child of await readAll(entry as FileSystemDirectoryEntry)) {
        await walk(child);
      }
    }
  }

  const entries = [...dataTransfer.items]
    .map((item) => (item.kind === "file" ? item.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => e != null);

  if (entries.length === 0) return [...dataTransfer.files];
  for (const entry of entries) {
    try {
      await walk(entry);
    } catch {
      // One unreadable entry shouldn't sink the drop.
    }
  }
  return out;
}

export function ContentAuditTool({ history }: { history?: AuditHistorySummary }) {
  const router = useRouter();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const runId = useRef(0);
  /** Extracted text per file, kept client-side for on-demand Eddy reviews. */
  const textByFile = useRef(new Map<string, string>());
  const [groups, setGroups] = useState<LogicalDocResult[]>([]);
  const [modelReports, setModelReports] = useState<
    Record<
      string,
      { report?: EddyModelReport; pending?: boolean; error?: string | null; savedId?: string }
    >
  >({});

  const coverage = useMemo(
    () => analyzeModelCoverage(groups, DEFAULT_CONTENT_RULES),
    [groups]
  );

  const summary = useMemo(() => {
    const pass = rows.filter((r) => r.result.verdict === "pass").length;
    const unreadable = rows.filter((r) => r.result.verdict === "unreadable").length;
    const flagged = rows.length - pass - unreadable;
    const fails = rows.reduce(
      (s, r) => s + r.result.flags.filter((f) => f.severity === "fail").length,
      0
    );
    return { total: rows.length, pass, flagged, unreadable, fails };
  }, [rows]);

  async function runAudit(files: File[]) {
    const pdfs = files.filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (pdfs.length === 0) return;
    const id = ++runId.current;
    setRows([]);
    setExpanded(null);
    setProgress({ done: 0, total: pdfs.length });

    // Extract every part first, then check as logical documents so
    // "-Part-1..N" files are judged together the way the SOP means them.
    const extracted: ExtractedDoc[] = [];
    textByFile.current.clear();
    for (let i = 0; i < pdfs.length; i++) {
      if (runId.current !== id) return; // a newer run superseded this one
      const doc = await extractDocInBrowser(pdfs[i]);
      extracted.push(doc);
      textByFile.current.set(doc.fileName, doc.text);
      setProgress({ done: i + 1, total: pdfs.length });
    }
    if (runId.current !== id) return;
    const grouped = runContentChecksOnSet(extracted, DEFAULT_CONTENT_RULES);
    setGroups(grouped);
    setModelReports({});
    setRows(
      grouped
        .map((g) => ({
          fileName: g.baseName,
          partFiles: g.partFiles,
          partCount: g.partFiles.length,
          sizeKb: g.totalSizeKb,
          pages: g.totalPages,
          result: g.result,
        }))
        .sort((a, b) => severityRank(a.result.flags) - severityRank(b.result.flags))
    );
    setProgress(null);

    // Scoreboard row for the history trend — aggregates only, fire-and-forget.
    const failCounts: Record<string, number> = {};
    for (const g of grouped) {
      for (const f of g.result.flags) {
        if (f.severity === "info") continue;
        failCounts[f.code] = (failCounts[f.code] ?? 0) + 1;
      }
    }
    const modelStats = analyzeModelCoverage(grouped, DEFAULT_CONTENT_RULES).map((m) => ({
      label: m.modelLabel,
      missing: m.missingComponents,
      docs: m.docs.length,
      flagged: m.flaggedDocs,
    }));
    void logContentAuditRunAction({
      docsChecked: grouped.length,
      passed: grouped.filter((g) => g.result.verdict === "pass").length,
      flagged: grouped.filter((g) => g.result.verdict === "flagged").length,
      unreadable: grouped.filter((g) => g.result.verdict === "unreadable").length,
      failCounts,
      models: modelStats,
    }).then((res) => {
      if (res.ok) router.refresh(); // pull the new run into the history panel
    });
  }

  async function runEddy(target: AuditRow) {
    setRows((prev) =>
      prev.map((r) =>
        r.fileName === target.fileName ? { ...r, eddyPending: true, eddyError: null } : r
      )
    );
    const text = target.partFiles
      .map((f) => textByFile.current.get(f) ?? "")
      .join("\n")
      .trim();
    const res = await eddyReviewContentAction({
      fileName: target.fileName,
      claim: target.fileName,
      text,
      structuralNote: target.result.flags.map((f) => `[${f.severity}] ${f.code}`).join(", "),
    });
    setRows((prev) =>
      prev.map((r) =>
        r.fileName === target.fileName
          ? {
              ...r,
              eddyPending: false,
              eddy: res.ok ? res.review : null,
              eddyError: res.ok ? null : res.message,
            }
          : r
      )
    );
  }

  async function runEddyOnFlagged() {
    const targets = rows.filter((r) => r.result.verdict === "flagged" && !r.eddy && !r.eddyPending);
    if (targets.length === 0) return;
    const cents = Math.max(1, Math.round(targets.length * 1));
    if (
      !confirm(
        `Ask Eddy to read ${targets.length} flagged document${targets.length === 1 ? "" : "s"}? Estimated cost ≈ ${cents}¢ total. Results are advisory — you decide what matters.`
      )
    ) {
      return;
    }
    for (const t of targets) {
      // Sequential on purpose: keeps costs visible and the UI readable.
      await runEddy(t);
    }
  }

  function coverageSummaryFor(model: ModelCoverage): string {
    const lines = [
      ...Object.entries(model.componentsPresent).map(
        ([slot, docs]) => `${slot}: covered by ${docs.join("; ")}`
      ),
      ...model.missingComponents.map((c) => `${c}: MISSING`),
      ...(model.extraDocs.length ? [`Extra (not in required set): ${model.extraDocs.join("; ")}`] : []),
    ];
    return lines.join("\n");
  }

  async function runModelReport(model: ModelCoverage) {
    setModelReports((prev) => ({
      ...prev,
      [model.modelLabel]: { ...prev[model.modelLabel], pending: true, error: null },
    }));
    const docLines = model.docs.map((d) => {
      const row = rows.find((r) => r.fileName === d.baseName);
      const flags = d.result.flags.map((f) => `[${f.severity}] ${f.message}`).join(" | ") || "clean";
      const eddy = row?.eddy
        ? ` || Eddy: ${row.eddy.verdict} — ${row.eddy.summary}`
        : "";
      return `${d.baseName} (${d.partFiles.length} part${d.partFiles.length === 1 ? "" : "s"}) → ${d.result.verdict}: ${flags}${eddy}`;
    });
    const res = await eddyModelReportAction({
      modelLabel: model.modelLabel,
      coverageSummary: coverageSummaryFor(model),
      docLines,
    });
    setModelReports((prev) => ({
      ...prev,
      [model.modelLabel]: res.ok
        ? { report: res.report, pending: false, error: null }
        : { ...prev[model.modelLabel], pending: false, error: res.message },
    }));
  }

  async function saveModelReport(model: ModelCoverage) {
    const entry = modelReports[model.modelLabel];
    if (!entry?.report) return;
    const res = await saveModelReportAction({
      modelLabel: model.modelLabel,
      coverageSummary: coverageSummaryFor(model),
      report: entry.report,
    });
    setModelReports((prev) => ({
      ...prev,
      [model.modelLabel]: res.ok
        ? { ...prev[model.modelLabel], savedId: res.documentId }
        : { ...prev[model.modelLabel], error: res.message },
    }));
  }

  function downloadCsv() {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      ["File", "Verdict", "Pages", "Size KB", "Flags", "Eddy"].join(","),
      ...rows.map((r) =>
        [
          esc(r.fileName),
          r.result.verdict,
          String(r.pages),
          String(r.sizeKb),
          esc(r.result.flags.map((f) => `[${f.severity}] ${f.message}`).join(" | ")),
          esc(
            r.eddy
              ? `${r.eddy.verdict}: ${r.eddy.summary} ${r.eddy.findings
                  .map((f) => `[${f.severity}] ${f.issue}`)
                  .join(" | ")}`
              : ""
          ),
        ].join(",")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `content-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void collectDroppedFiles(e.dataTransfer).then((files) => runAudit(files));
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors",
          dragOver ? "border-primary bg-primary/10" : "border-border/60 hover:border-primary/50"
        )}
      >
        <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">
          Drop a whole folder of SI PDFs here (subfolders included) — or click to pick files
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Everything runs on YOUR computer. Files are never uploaded; close the tab and nothing
          leaves this machine.
        </p>
        <button
          type="button"
          className="mt-2 text-xs text-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            folderInputRef.current?.click();
          }}
        >
          …or browse to a folder
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void runAudit([...e.target.files]);
            e.target.value = "";
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          {...{ webkitdirectory: "" }}
          onChange={(e) => {
            if (e.target.files) void runAudit([...e.target.files]);
            e.target.value = "";
          }}
        />
      </div>

      {progress && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Checking {progress.done}/{progress.total}…
        </div>
      )}

      {rows.length === 0 && !progress && history && history.runs.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="enterprise-panel p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Flag rate by run · {history.totalDocsChecked.toLocaleString()} docs checked all-time
            </p>
            <div className="flex h-20 items-end gap-1">
              {history.runs.slice(-24).map((r, i) => (
                <div
                  key={i}
                  title={`${new Date(r.run_at).toLocaleDateString()} — ${r.docs} docs, ${r.flagRatePct}% flagged${r.isSpotCheck ? " (spot check)" : ""}`}
                  className={cn(
                    "flex-1 rounded-sm",
                    r.isSpotCheck
                      ? "bg-muted/50"
                      : r.flagRatePct > 50
                        ? "bg-red-400/70"
                        : r.flagRatePct > 20
                          ? "bg-amber-400/70"
                          : "bg-emerald-400/70"
                  )}
                  style={{ height: `${Math.max(8, r.flagRatePct)}%` }}
                />
              ))}
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Green &lt;20% · amber &lt;50% · red above · gray = spot check
            </p>
          </div>

          <div className="enterprise-panel p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Most common violations</p>
            {history.topViolations.length === 0 ? (
              <p className="text-xs text-muted-foreground">None recorded yet.</p>
            ) : (
              <ul className="space-y-1">
                {history.topViolations.slice(0, 6).map((v) => (
                  <li key={v.code} className="flex items-center justify-between text-xs">
                    <span className="capitalize">{v.code.replace(/_/g, " ")}</span>
                    <span className="tabular-nums text-muted-foreground">{v.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="enterprise-panel p-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Models with open gaps ({history.openGaps.length})
            </p>
            {history.openGaps.length === 0 ? (
              <p className="text-xs text-emerald-500">
                No known coverage gaps — every audited model is complete.
              </p>
            ) : (
              <ul className="max-h-24 space-y-1 overflow-y-auto pr-1">
                {history.openGaps.slice(0, 20).map((g) => (
                  <li key={g.label} className="text-xs">
                    <span className="font-medium">{g.label}</span>
                    <span className="text-red-400"> — missing {g.missing.join(", ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="enterprise-panel p-4">
              <p className="text-xs text-muted-foreground">Checked</p>
              <p className="text-2xl font-semibold tabular-nums">{summary.total}</p>
            </div>
            <div className="enterprise-panel p-4">
              <p className="text-xs text-muted-foreground">Pass</p>
              <p className="text-2xl font-semibold tabular-nums text-emerald-500">{summary.pass}</p>
            </div>
            <div className="enterprise-panel p-4">
              <p className="text-xs text-muted-foreground">Flagged</p>
              <p
                className={cn(
                  "text-2xl font-semibold tabular-nums",
                  summary.flagged > 0 ? "text-amber-400" : ""
                )}
              >
                {summary.flagged}
              </p>
              <p className="text-[11px] text-muted-foreground">{summary.fails} SOP failures</p>
            </div>
            <div className="enterprise-panel p-4">
              <p className="text-xs text-muted-foreground">Unreadable</p>
              <p className="text-2xl font-semibold tabular-nums">{summary.unreadable}</p>
            </div>
          </div>

          {coverage.length > 0 && (
            <div className="space-y-3">
              {coverage.map((model) => {
                const entry = modelReports[model.modelLabel] ?? {};
                const required = Object.keys(model.componentsPresent).length + model.missingComponents.length;
                return (
                  <div key={model.modelLabel} className="enterprise-panel p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{model.modelLabel}</p>
                        <p className="text-xs text-muted-foreground">
                          {model.docs.length} document{model.docs.length === 1 ? "" : "s"} ·{" "}
                          {required - model.missingComponents.length}/{required} required
                          components covered
                          {model.flaggedDocs > 0 && ` · ${model.flaggedDocs} flagged`}
                        </p>
                      </div>
                      {!entry.report && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={entry.pending}
                          onClick={() => void runModelReport(model)}
                        >
                          {entry.pending ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
                          )}
                          {entry.pending ? "Eddy is writing…" : "Eddy model report (~2¢)"}
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(model.componentsPresent).map(([slot, docs]) => (
                        <Badge
                          key={slot}
                          variant="outline"
                          className="text-[10px] text-emerald-500 border-emerald-500/30"
                          title={docs.join("\n")}
                        >
                          <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
                          {slot}
                        </Badge>
                      ))}
                      {model.missingComponents.map((slot) => (
                        <Badge
                          key={slot}
                          variant="outline"
                          className="text-[10px] text-red-400 border-red-500/40"
                        >
                          <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                          {slot} missing
                        </Badge>
                      ))}
                    </div>

                    {entry.error && <p className="text-xs text-destructive">{entry.error}</p>}

                    {entry.report && (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="flex items-center gap-1.5 text-xs font-medium">
                            <Sparkles className="h-3.5 w-3.5 text-primary" />
                            Eddy&apos;s model report
                          </p>
                          {entry.savedId ? (
                            <a
                              href={`/files/view/company/${entry.savedId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              Saved to Files — open it
                            </a>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => void saveModelReport(model)}
                            >
                              Save report to Files
                            </Button>
                          )}
                        </div>
                        <p className="text-xs">{entry.report.overview}</p>
                        {entry.report.risks.length > 0 && (
                          <ul className="space-y-1">
                            {entry.report.risks.map((r, i) => (
                              <li key={i} className="text-xs">
                                <span
                                  className={cn(
                                    "mr-1.5 font-medium",
                                    r.severity === "high"
                                      ? "text-red-400"
                                      : r.severity === "medium"
                                        ? "text-amber-400"
                                        : "text-muted-foreground"
                                  )}
                                >
                                  {r.severity}:
                                </span>
                                {r.issue}
                              </li>
                            ))}
                          </ul>
                        )}
                        {entry.report.actions.length > 0 && (
                          <ol className="list-decimal space-y-0.5 pl-4 text-xs text-muted-foreground">
                            {entry.report.actions.map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Flagged files sort first. Click a row for details.
            </p>
            <div className="flex items-center gap-2">
              {summary.flagged > 0 && (
                <Button variant="outline" size="sm" onClick={() => void runEddyOnFlagged()}>
                  <Sparkles className="mr-1.5 h-4 w-4 text-primary" />
                  Ask Eddy about flagged ({summary.flagged} · ~{Math.max(1, summary.flagged)}¢)
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={downloadCsv}>
                <Download className="mr-1.5 h-4 w-4" />
                Download report (CSV)
              </Button>
            </div>
          </div>

          <div className="enterprise-panel divide-y divide-border/40 overflow-hidden">
            {rows.map((row) => (
              <div key={row.fileName}>
                <button
                  type="button"
                  onClick={() => setExpanded(expanded === row.fileName ? null : row.fileName)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted/30"
                >
                  <FileWarning
                    className={cn(
                      "h-4 w-4 shrink-0",
                      row.result.verdict === "pass" ? "text-emerald-500/50" : "text-muted-foreground"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {row.fileName}
                    {row.partCount > 1 && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({row.partCount} parts)
                      </span>
                    )}
                  </span>
                  <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums">
                    {row.pages}p · {row.sizeKb}KB
                  </span>
                  {verdictBadge(row)}
                </button>
                {expanded === row.fileName && (
                  <div className="space-y-3 bg-muted/10 px-11 py-3">
                    {row.result.flags.length > 0 && (
                      <ul className="space-y-1.5">
                        {row.result.flags.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <span
                              className={cn(
                                "mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full",
                                f.severity === "fail"
                                  ? "bg-red-400"
                                  : f.severity === "warn"
                                    ? "bg-amber-400"
                                    : "bg-sky-400"
                              )}
                            />
                            <span>{f.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}

                    {row.eddy ? (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-medium">
                          <Sparkles className="h-3.5 w-3.5 text-primary" />
                          Eddy&apos;s read:{" "}
                          <span
                            className={cn(
                              row.eddy.verdict === "looks_right" && "text-emerald-500",
                              row.eddy.verdict === "issues_found" && "text-amber-400",
                              row.eddy.verdict === "cannot_assess" && "text-muted-foreground"
                            )}
                          >
                            {row.eddy.verdict === "looks_right"
                              ? "content supports the label"
                              : row.eddy.verdict === "issues_found"
                                ? "worth a human look"
                                : "not enough text to judge"}
                          </span>
                        </p>
                        {row.eddy.summary && (
                          <p className="mt-1 text-xs text-muted-foreground">{row.eddy.summary}</p>
                        )}
                        {row.eddy.findings.length > 0 && (
                          <ul className="mt-2 space-y-1.5">
                            {row.eddy.findings.map((f, i) => (
                              <li key={i} className="text-xs">
                                <span
                                  className={cn(
                                    "mr-1.5 font-medium",
                                    f.severity === "high"
                                      ? "text-red-400"
                                      : f.severity === "medium"
                                        ? "text-amber-400"
                                        : "text-muted-foreground"
                                  )}
                                >
                                  {f.severity}:
                                </span>
                                {f.issue}
                                {f.quote && (
                                  <span className="text-muted-foreground"> — “{f.quote}”</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          disabled={row.eddyPending}
                          onClick={() => void runEddy(row)}
                        >
                          {row.eddyPending ? (
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-primary" />
                          )}
                          {row.eddyPending ? "Eddy is reading…" : "Ask Eddy to read it (~1¢)"}
                        </Button>
                        {row.eddyError && (
                          <span className="text-xs text-destructive">{row.eddyError}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
