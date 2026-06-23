import Link from "next/link";
import { DocsMarkdown, DocsSidebarNav } from "@/components/docs/docs-markdown";
import { Button } from "@/components/ui/button";
import type { DocEntry } from "@/lib/docs/catalog";
import { ArrowLeft } from "lucide-react";

export function DocsArticleView({
  entry,
  markdown,
}: {
  entry: DocEntry;
  markdown: string;
}) {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 px-2" render={<Link href="/docs" />}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          All docs
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-16 rounded-lg border border-border/60 bg-card/50 p-3 max-h-[calc(100vh-5rem)] overflow-y-auto">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-3">
              Contents
            </p>
            <DocsSidebarNav activeSlug={entry.slug} />
          </div>
        </aside>

        <div className="min-w-0 rounded-lg border border-border/60 bg-card/30 p-4 sm:p-6 lg:p-8">
          <DocsMarkdown markdown={markdown} />
        </div>
      </div>
    </div>
  );
}
