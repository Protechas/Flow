import "server-only";

import type { ExtractedDoc, ExtractedHighlight } from "@/lib/content-checks/engine";
import { classifyHighlightColor } from "@/lib/content-checks/engine";

/**
 * Server-side PDF extraction — mirror of extract-browser.ts for the QA door,
 * where checks run after submission on files already in storage. Uses the
 * pdfjs legacy build (no worker, no DOM), same pattern as the accuracy
 * harness in scripts/audit-real-docs.mjs.
 */

const MAX_TEXT_PAGES = 6;

type PdfJsLegacy = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfJsLegacy> | null = null;

async function loadPdfjs(): Promise<PdfJsLegacy> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsPromise;
}

export async function extractDocFromBuffer(
  fileName: string,
  buffer: Buffer
): Promise<ExtractedDoc> {
  const base: ExtractedDoc = {
    fileName,
    fileSizeBytes: buffer.length,
    numPages: 0,
    landscapePages: 0,
    text: "",
    hasTextLayer: false,
    highlights: [],
  };

  let doc;
  try {
    const pdfjs = await loadPdfjs();
    doc = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    }).promise;
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
        text +=
          content.items.map((i) => ("str" in i ? i.str : "")).join(" ") + "\n";
      }

      const annotations = await page.getAnnotations();
      for (const a of annotations) {
        if (a.subtype === "Highlight") {
          highlights.push({
            page: p,
            colorGroup: classifyHighlightColor(
              a.color ? Array.from(a.color as Iterable<number>) : null
            ),
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
