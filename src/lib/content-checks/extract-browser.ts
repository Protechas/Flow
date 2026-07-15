"use client";

import type { ExtractedDoc, ExtractedHighlight } from "@/lib/content-checks/engine";
import { classifyHighlightColor } from "@/lib/content-checks/engine";

/**
 * Client-side PDF extraction for the Tools batch auditor. Runs entirely in
 * the reader's browser — files never leave the machine, the server never
 * pays for a byte (the Tools performance rule).
 */

const MAX_TEXT_PAGES = 6;

type PdfJs = typeof import("pdfjs-dist");
let pdfjsPromise: Promise<PdfJs> | null = null;

async function loadPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function extractDocInBrowser(file: File): Promise<ExtractedDoc> {
  const base: ExtractedDoc = {
    fileName: file.name,
    fileSizeBytes: file.size,
    numPages: 0,
    landscapePages: 0,
    text: "",
    hasTextLayer: false,
    highlights: [],
  };

  let doc: import("pdfjs-dist").PDFDocumentProxy;
  try {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    doc = await pdfjs.getDocument({ data }).promise;
  } catch {
    return base; // numPages 0 → engine reports it as unreadable
  }

  base.numPages = doc.numPages;
  const highlights: ExtractedHighlight[] = [];
  let text = "";

  for (let p = 1; p <= doc.numPages; p++) {
    try {
      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 1, rotation: page.rotate });
      if (viewport.width > viewport.height) base.landscapePages++;

      if (p <= MAX_TEXT_PAGES) {
        const content = await page.getTextContent();
        text += content.items
          .map((i) => ("str" in i ? i.str : ""))
          .join(" ") + "\n";
      }

      const annotations = await page.getAnnotations();
      for (const a of annotations) {
        if (a.subtype === "Highlight") {
          highlights.push({
            page: p,
            colorGroup: classifyHighlightColor(a.color ? Array.from(a.color as Iterable<number>) : null),
          });
        }
      }
    } catch {
      // A single unreadable page shouldn't sink the document.
    }
  }

  base.text = text;
  base.hasTextLayer = text.replace(/\s+/g, "").length > 100;
  base.highlights = highlights;
  return base;
}
