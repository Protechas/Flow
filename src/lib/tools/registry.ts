/** The Tools hub — small utilities housed under /tools.
 * Add a tool: build its page under app/(app)/tools/<id>/ and register it here.
 */

export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  href: string;
  /** lucide icon name resolved by the hub page */
  icon: "FileSearch" | "Calculator" | "Wrench" | "ShieldCheck";
}

export const TOOLS: ToolEntry[] = [
  {
    id: "content-audit",
    name: "Content Audit",
    description:
      "Drop a folder of SI PDFs and batch-check them against the library SOPs — naming grammar, size, orientation, highlights, and content-vs-label identity. Runs entirely in your browser.",
    href: "/tools/content-audit",
    icon: "ShieldCheck",
  },
  {
    id: "file-check",
    name: "File Name Checker",
    description:
      "Paste or drop a file list and see how it counts as effective documents — split parts collapsed, duplicates flagged — before anything is uploaded.",
    href: "/tools/file-check",
    icon: "FileSearch",
  },
  {
    id: "labor-cost",
    name: "Labor Cost Calculator",
    description:
      "Hours × people × rate. Cost per document and docs per hour for sizing a package or pricing a request.",
    href: "/tools/labor-cost",
    icon: "Calculator",
  },
];
