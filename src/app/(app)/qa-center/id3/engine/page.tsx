import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { Id3Tabs } from "@/components/qa-center/id3-tabs";
import { QaEngineUpload } from "@/components/qa-center/qa-engine-upload";
import { QaFindingsDashboard } from "@/components/qa-center/qa-findings-dashboard";
import { Badge } from "@/components/ui/badge";
import { requirePageAccess } from "@/lib/auth/guard";
import { listValidationRuns } from "@/lib/validation-center/runs";
import { listQaEngineFindings } from "@/lib/validation-center/qa-engine-findings";
import { getAuditWorkerStatus } from "@/lib/validation-center/worker-status";
import { formatAppDateTime } from "@/lib/datetime/timezone";
import { cn } from "@/lib/utils";
import { ArrowRight, FileDown } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  completed: "border-emerald-500/40 text-emerald-500",
  processing: "border-blue-500/40 text-blue-400",
  pending: "border-amber-500/40 text-amber-500",
  failed: "border-destructive/50 text-destructive",
};

/** QA Intelligence Engine — Phase 1. Upload → run checks → review → export. */
export default async function QaEnginePage() {
  await requirePageAccess("/qa-center/id3");
  const [runs, findings, worker] = await Promise.all([
    listValidationRuns(),
    listQaEngineFindings(),
    getAuditWorkerStatus(),
  ]);
  const scans = runs.filter((r) => r.engine_id === "qa_engine");

  return (
    <>
      <PageHeader
        title="QA Engine"
        description="Upload files → run checks → review findings → download the Excel report"
      />
      <QaCenterSubnav />
      <Id3Tabs />

      {!worker.online && (
        <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          The audit worker is offline — scans will queue and process automatically when it comes
          online.
        </p>
      )}

      <QaEngineUpload />

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Scans
        </h2>
        {scans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No scans yet.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Scan</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-right">Findings</th>
                  <th className="px-4 py-2.5 text-left">Created</th>
                  <th className="px-4 py-2.5 text-right">Report</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((run) => {
                  const workbook = run.files.find((f) => f.role === "output_workbook");
                  return (
                    <tr key={run.id} className="border-t border-border/40">
                      <td className="px-4 py-2.5 font-medium">{run.title}</td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", STATUS_STYLES[run.status] ?? "")}
                        >
                          {run.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{run.findings_count}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {formatAppDateTime(run.created_at)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-3">
                          {workbook && (
                            <a
                              href={`/api/validation/files/${workbook.id}`}
                              download={workbook.file_name}
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <FileDown className="h-3 w-3" />
                              Download Excel
                            </a>
                          )}
                          <Link
                            href={`/qa-center/validation/runs/${run.id}`}
                            prefetch={false}
                            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            Open
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Findings
        </h2>
        <QaFindingsDashboard findings={findings} />
      </section>
    </>
  );
}
