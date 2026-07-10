import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, PencilLine } from "lucide-react";

/**
 * Read view for a document's in-Flow working copy (server component).
 * Shown instead of the original-file viewer once a doc has been edited in Flow.
 */
export function FlowDocumentContentView({
  title,
  fileName,
  html,
  updatedAt,
  backHref,
  documentId,
  canEdit,
}: {
  title: string;
  fileName: string;
  html: string;
  updatedAt: string | null;
  backHref: string;
  documentId: string;
  canEdit: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Button type="button" variant="ghost" size="sm" render={<Link href={backHref} prefetch={false} />}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium truncate">{title}</p>
              <Badge variant="outline" className="text-[10px] shrink-0">
                Flow working copy
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {fileName}
              {updatedAt ? ` · Updated ${new Date(updatedAt).toLocaleString()}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              type="button"
              size="sm"
              render={<Link href={`/files/${documentId}/edit`} prefetch={false} />}
            >
              <PencilLine className="mr-1.5 h-4 w-4" />
              Edit
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            render={
              <Link
                href={`/api/documents/${documentId}?download=1`}
                download={fileName}
                prefetch={false}
              />
            }
          >
            <Download className="mr-1.5 h-4 w-4" />
            Original
          </Button>
        </div>
      </div>

      <div className="enterprise-panel">
        {/* Content is written only by managers through the in-Flow editor. */}
        <div className="flow-doc-editor px-6 py-5" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
