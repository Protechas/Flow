"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  companyDocumentDownloadHrefWithAttachment,
  companyDocumentDownloadHref,
  taskFileDownloadHref,
  taskFileDownloadHrefWithAttachment,
} from "@/lib/files/download";
import { getFilePreviewKind } from "@/lib/files/preview-kind";
import { cn } from "@/lib/utils";
import { Download, Loader2 } from "lucide-react";

type FileSource = "company" | "task";

export function DocumentViewer({
  source,
  id,
  title,
  fileName,
  mimeType,
  backHref = "/files",
}: {
  source: FileSource;
  id: string;
  title: string;
  fileName: string;
  mimeType: string;
  backHref?: string;
}) {
  const apiUrl =
    source === "company" ? companyDocumentDownloadHref(id) : taskFileDownloadHref(id);
  const downloadUrl =
    source === "company"
      ? companyDocumentDownloadHrefWithAttachment(id)
      : taskFileDownloadHrefWithAttachment(id);

  const previewKind = getFilePreviewKind(fileName, mimeType);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [sheetHtml, setSheetHtml] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error("Could not load this file");

        if (previewKind === "pdf" || previewKind === "image") {
          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          if (!cancelled) setBlobUrl(objectUrl);
          return;
        }

        if (previewKind === "text") {
          const text = await response.text();
          if (!cancelled) setTextContent(text);
          return;
        }

        if (previewKind === "spreadsheet") {
          const buffer = await response.arrayBuffer();
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "array" });
          const htmlBySheet: Record<string, string> = {};
          for (const name of workbook.SheetNames) {
            htmlBySheet[name] = XLSX.utils.sheet_to_html(workbook.Sheets[name], {
              id: `sheet-${name.replace(/\s+/g, "-")}`,
            });
          }
          if (!cancelled) {
            setSheetNames(workbook.SheetNames);
            setSheetHtml(htmlBySheet);
            setActiveSheet(0);
          }
          return;
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not open file");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiUrl, previewKind]);

  const activeSheetName = sheetNames[activeSheet];
  const activeHtml = activeSheetName ? sheetHtml[activeSheetName] : "";

  const unsupportedMessage = useMemo(() => {
    if (previewKind !== "unsupported") return null;
    return "This file type cannot be previewed in the browser. Use Download to open it in Excel or Word on your computer.";
  }, [previewKind]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-border">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Document</p>
          <h1 className="text-lg font-semibold truncate">{title}</h1>
          <p className="text-sm text-muted-foreground truncate">{fileName}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" render={<Link href={backHref} />}>
            ← Back to Files
          </Button>
          <Button variant="secondary" size="sm" render={<a href={downloadUrl} download={fileName} />}>
            <Download className="h-4 w-4 mr-1.5" />
            Download
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Opening file…
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && previewKind === "pdf" && blobUrl && (
        <iframe src={blobUrl} title={title} className="flex-1 w-full min-h-[70vh] rounded-lg border border-border bg-white" />
      )}

      {!loading && !error && previewKind === "image" && blobUrl && (
        <div className="flex-1 flex items-center justify-center p-4 bg-muted/20 rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={blobUrl} alt={title} className="max-w-full max-h-[75vh] object-contain" />
        </div>
      )}

      {!loading && !error && previewKind === "text" && textContent !== null && (
        <pre className="flex-1 overflow-auto rounded-lg border border-border bg-muted/20 p-4 text-sm whitespace-pre-wrap">
          {textContent}
        </pre>
      )}

      {!loading && !error && previewKind === "spreadsheet" && (
        <div className="flex-1 flex flex-col min-h-0">
          {sheetNames.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {sheetNames.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setActiveSheet(index)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                    index === activeSheet
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 border-border hover:bg-muted/50"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <div
            className="flex-1 overflow-auto rounded-lg border border-border bg-white text-black spreadsheet-preview"
            dangerouslySetInnerHTML={{ __html: activeHtml }}
          />
        </div>
      )}

      {!loading && unsupportedMessage && (
        <div className="rounded-lg border border-border bg-muted/20 px-4 py-8 text-center text-muted-foreground">
          <p className="text-sm">{unsupportedMessage}</p>
        </div>
      )}
    </div>
  );
}
