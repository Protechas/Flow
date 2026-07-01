import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  ClipboardCheck,
  FileUp,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { KpiStrip } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import type { QaCenterDashboardStats } from "@/lib/qa-center/types";

export function QaCenterDashboardView({ stats }: { stats: QaCenterDashboardStats }) {
  return (
    <>
      <QaCenterSubnav />

      {!stats.libraryReady && (
        <div className="mb-6 flex flex-wrap items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Knowledge library incomplete
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.libraryLoadedCount} of {stats.libraryTotalCount} reference entries have active
              files. Upload SI Content SOP, SI Library SOP, and manufacturer component charts before
              relying on validation scores.
            </p>
          </div>
          <Button size="sm" variant="outline" render={<Link href="/qa-center/knowledge" />}>
            Open library
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground max-w-3xl mb-6">
        Enterprise quality assurance for Service Information — bulk validation, rule-based
        checks, knowledge-backed review, and analyst performance tracking.
      </p>

      <KpiStrip
        columns={4}
        items={[
          {
            label: "Files submitted",
            value: stats.filesSubmitted,
            href: "/qa-center/validation/runs",
          },
          {
            label: "Pre-validation passed",
            value: stats.preValidationPassed,
            sublabel:
              stats.averageReviewMinutes != null
                ? `Avg review ${stats.averageReviewMinutes} min`
                : undefined,
            href: "/qa-center/upload",
          },
          {
            label: "SI audit passed",
            value: stats.passed - stats.preValidationPassed,
            sublabel: stats.averageQaScore != null ? `Avg score ${stats.averageQaScore}%` : undefined,
          },
          {
            label: "Open issues",
            value: stats.openFindings || "—",
            warn: stats.openFindings > 0,
            href: "/qa-center/validation/findings",
          },
          {
            label: "Critical / high",
            value: stats.critical > 0 ? stats.critical : "—",
            critical: stats.critical > 0,
            href: "/qa-center/validation/findings",
          },
        ]}
      />

      <KpiStrip
        className="mt-3"
        columns={6}
        items={[
          {
            label: "Review queue",
            value: stats.reviewQueueCount,
            href: "/qa-center/review",
            warn: stats.reviewQueueCount > 0,
          },
          {
            label: "Upload queue",
            value: stats.uploadQueueCount,
            href: "/qa-center/upload",
            warn: stats.uploadQueueCount > 0,
          },
          {
            label: "Validation queue",
            value: stats.validationQueueCount,
            href: "/qa-center/validation",
          },
          {
            label: "Knowledge entries",
            value: stats.knowledgeEntries,
            href: "/qa-center/knowledge",
          },
          {
            label: "Gold standards",
            value: stats.goldStandards,
            href: "/qa-center/knowledge",
          },
        ]}
      />

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="enterprise-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileUp className="h-4 w-4 text-primary" />
              Upload documents
            </CardTitle>
            <CardDescription>Bulk PDF, ZIP, and manufacturer packages</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/qa-center/upload" />}>
              Open upload queue
            </Button>
          </CardContent>
        </Card>
        <Card className="enterprise-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              Run validation
            </CardTitle>
            <CardDescription>Layered rules + knowledge-backed smart review</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" render={<Link href="/qa-center/validation/new" />}>
              New validation
            </Button>
            <Button size="sm" variant="ghost" render={<Link href="/qa-center/validation/findings" />}>
              View findings
            </Button>
          </CardContent>
        </Card>
        <Card className="enterprise-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Review queue
            </CardTitle>
            <CardDescription>Human QA approval and corrections</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/qa-center/review" />}>
              Open review queue
            </Button>
          </CardContent>
        </Card>
        <Card className="enterprise-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              Knowledge library
            </CardTitle>
            <CardDescription>SOPs, charts, and gold standard references</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/qa-center/knowledge" />}>
              Manage knowledge
            </Button>
          </CardContent>
        </Card>
        <Card className="enterprise-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Rule engine
            </CardTitle>
            <CardDescription>Configure validation rules without code</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/qa-center/rules" />}>
              Edit rules
            </Button>
          </CardContent>
        </Card>
        <Card className="enterprise-panel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Pre-submit check
            </CardTitle>
            <CardDescription>Analysts validate before sending to QA</CardDescription>
          </CardHeader>
          <CardContent>
            <Button size="sm" variant="outline" render={<Link href="/qa-center/upload" />}>
              Validate before submit
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
