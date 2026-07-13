"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createBlankDocumentAction,
  createDocumentFolderAction,
  deleteCompanyDocumentAction,
  deleteDocumentFolderAction,
  renameDocumentFolderAction,
  updateCompanyDocumentMetaAction,
  uploadCompanyDocumentAction,
} from "@/app/actions/company-documents";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFlowToast } from "@/components/ui/flow-toast";
import { COMPANY_DOCUMENT_CATEGORIES } from "@/lib/files/company-document-categories";
import { fileViewHref } from "@/lib/files/download";
import { cn } from "@/lib/utils";
import {
  clientCompanyDocumentMaxBytes,
  formatUploadLimitLabel,
} from "@/lib/files/upload-limits-client";
import type { CompanyDocumentView, DocumentFolder } from "@/types/flow";
import { format } from "date-fns";
import {
  BookOpen,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Loader2,
  MoreHorizontal,
  PencilLine,
  Search,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";

/** Custom drag payload so doc-row drags are distinguishable from OS file drags. */
const DOC_DRAG_TYPE = "application/x-flow-doc";

type FileKind = "word" | "pdf" | "excel" | "image" | "text" | "flow" | "other";

const KIND_LABELS: Record<FileKind, string> = {
  word: "Word",
  pdf: "PDF",
  excel: "Excel",
  image: "Image",
  text: "Text",
  flow: "Flow doc",
  other: "Other",
};

function fileKind(doc: CompanyDocumentView): FileKind {
  const name = doc.file_name.toLowerCase();
  const mime = doc.mime_type;
  if (name.endsWith(".docx") || name.endsWith(".doc") || mime.includes("wordprocessingml") || mime === "application/msword") return "word";
  if (name.endsWith(".pdf") || mime === "application/pdf") return "pdf";
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || mime.includes("spreadsheetml") || mime === "application/vnd.ms-excel") return "excel";
  if (mime.startsWith("image/")) return "image";
  if (name.endsWith(".txt") || mime === "text/plain") return "text";
  if (name.endsWith(".html") || mime === "text/html") return "flow";
  return "other";
}

function kindIcon(kind: FileKind) {
  switch (kind) {
    case "excel":
      return FileSpreadsheet;
    case "image":
      return ImageIcon;
    case "flow":
      return PencilLine;
    default:
      return FileText;
  }
}

function isEditableInFlow(doc: CompanyDocumentView): boolean {
  const kind = fileKind(doc);
  if (kind === "word") return doc.file_name.toLowerCase().endsWith(".docx");
  return kind === "text" || kind === "flow";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(category: string) {
  return COMPANY_DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

/** Folders ordered as a tree (depth-first) with indent level for rendering. */
function flattenTree(folders: DocumentFolder[]): { folder: DocumentFolder; depth: number }[] {
  const byParent = new Map<string | null, DocumentFolder[]>();
  for (const f of folders) {
    const key = f.parent_id ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), f]);
  }
  const out: { folder: DocumentFolder; depth: number }[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const f of byParent.get(parentId) ?? []) {
      out.push({ folder: f, depth });
      walk(f.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** A folder plus all its descendants — selecting a folder shows its whole subtree. */
function folderSubtreeIds(folders: DocumentFolder[], rootId: string): Set<string> {
  const ids = new Set<string>([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parent_id && ids.has(f.parent_id) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function CompanyDocumentsPanel({
  documents,
  folders,
  canManage,
  employeeView = false,
}: {
  documents: CompanyDocumentView[];
  folders: DocumentFolder[];
  canManage: boolean;
  employeeView?: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();

  // --- Browsing state ---
  const [folderId, setFolderId] = useState<string | "all" | "root">("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [tagFilter, setTagFilter] = useState("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [uploaderFilter, setUploaderFilter] = useState("all");

  // --- Upload state ---
  const [dragOver, setDragOver] = useState(false);
  const [queue, setQueue] = useState<File[]>([]);
  /** Where the queued files will land; set by the drop zone or a folder drop. */
  const [queueFolderId, setQueueFolderId] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState("sop");
  const [uploadTags, setUploadTags] = useState("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // --- Explorer drag state (doc rows / OS files over a folder) ---
  const [dropFolderId, setDropFolderId] = useState<string | "root" | null>(null);

  // --- New Flow-native document state ---
  const [newDocOpen, setNewDocOpen] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocCategory, setNewDocCategory] = useState("sop");
  const [newDocTags, setNewDocTags] = useState("");

  // --- Folder management state ---
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renameTarget, setRenameTarget] = useState<DocumentFolder | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // --- Tag edit state ---
  const [tagTarget, setTagTarget] = useState<CompanyDocumentView | null>(null);
  const [tagValue, setTagValue] = useState("");

  const tree = useMemo(() => flattenTree(folders), [folders]);

  const docCounts = useMemo(() => {
    const counts = new Map<string | null, number>();
    for (const d of documents) {
      const key = d.folder_id ?? null;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [documents]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    for (const d of documents) for (const t of d.tags) tags.add(t);
    return [...tags].sort();
  }, [documents]);

  const allUploaders = useMemo(() => {
    const names = new Map<string, string>();
    for (const d of documents) names.set(d.uploaded_by, d.uploaded_by_name ?? d.uploaded_by);
    return [...names.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [documents]);

  const visibleDocs = useMemo(() => {
    let docs = documents;
    if (folderId === "root") {
      docs = docs.filter((d) => d.folder_id == null);
    } else if (folderId !== "all") {
      const ids = folderSubtreeIds(folders, folderId);
      docs = docs.filter((d) => d.folder_id != null && ids.has(d.folder_id));
    }
    if (category !== "all") docs = docs.filter((d) => d.category === category);
    if (tagFilter !== "all") docs = docs.filter((d) => d.tags.includes(tagFilter));
    if (kindFilter !== "all") docs = docs.filter((d) => fileKind(d) === kindFilter);
    if (uploaderFilter !== "all") docs = docs.filter((d) => d.uploaded_by === uploaderFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      docs = docs.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.file_name.toLowerCase().includes(q) ||
          (d.description ?? "").toLowerCase().includes(q) ||
          d.tags.some((t) => t.includes(q))
      );
    }
    return docs;
  }, [documents, folders, folderId, category, tagFilter, kindFilter, uploaderFilter, search]);

  const currentFolderForUpload = folderId !== "all" && folderId !== "root" ? folderId : null;
  const folderName = (id: string | null) =>
    id == null ? "All documents" : folders.find((f) => f.id === id)?.name ?? "Folder";

  const onPickFiles = useCallback(
    (fileList: FileList | File[], destFolderId?: string | null) => {
      const files = Array.from(fileList).filter((f) => f.size > 0);
      if (!files.length) return;
      setQueue((prev) => [...prev, ...files]);
      setQueueFolderId(destFolderId !== undefined ? destFolderId : currentFolderForUpload);
    },
    [currentFolderForUpload]
  );

  const uploadQueue = useCallback(() => {
    if (queue.length === 0) return;
    startTransition(async () => {
      let failed = 0;
      setProgress({ done: 0, total: queue.length });
      for (let i = 0; i < queue.length; i++) {
        const file = queue[i];
        const fd = new FormData();
        fd.set("title", file.name.replace(/\.[^.]+$/, ""));
        fd.set("description", "");
        fd.set("category", uploadCategory);
        fd.set("folder_id", queueFolderId ?? "");
        fd.set("tags", uploadTags);
        fd.set("file", file);
        const res = await uploadCompanyDocumentAction(fd);
        if (!res.ok) {
          failed += 1;
          toast({ variant: "error", title: `Upload failed: ${file.name}`, description: res.message });
        }
        setProgress({ done: i + 1, total: queue.length });
      }
      const succeeded = queue.length - failed;
      if (succeeded > 0) {
        toast({
          variant: "success",
          title: `${succeeded} file${succeeded === 1 ? "" : "s"} uploaded`,
          description:
            queueFolderId != null
              ? `Into ${folderName(queueFolderId)}`
              : "Into Unfiled (no folder)",
        });
      }
      setQueue([]);
      setProgress(null);
      router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, uploadCategory, uploadTags, queueFolderId, router, toast]);

  /** Explorer behavior: drop a doc row to move it, or OS files to upload here. */
  const handleFolderDrop = (target: string | null, key: string | "root") => (
    e: React.DragEvent
  ) => {
    if (!canManage) return;
    e.preventDefault();
    e.stopPropagation();
    setDropFolderId(null);
    const docId = e.dataTransfer.getData(DOC_DRAG_TYPE);
    if (docId) {
      const doc = documents.find((d) => d.id === docId);
      if (doc && doc.folder_id !== target) moveDoc(doc, target);
      return;
    }
    if (e.dataTransfer.files.length) {
      if (key !== "root") setFolderId(key);
      onPickFiles(e.dataTransfer.files, target);
    }
  };

  const handleFolderDragOver = (key: string | "root") => (e: React.DragEvent) => {
    if (!canManage) return;
    e.preventDefault();
    e.stopPropagation();
    setDropFolderId(key);
  };

  const moveDoc = (doc: CompanyDocumentView, target: string | null) => {
    startTransition(async () => {
      const res = await updateCompanyDocumentMetaAction(doc.id, { folder_id: target });
      if (!res.ok) {
        toast({ variant: "error", title: "Move failed", description: res.message });
        return;
      }
      toast({ variant: "success", title: `Moved to ${folderName(target)}` });
      router.refresh();
    });
  };

  const saveTags = () => {
    if (!tagTarget) return;
    const doc = tagTarget;
    const tags = tagValue.split(",").map((t) => t.trim()).filter(Boolean);
    setTagTarget(null);
    startTransition(async () => {
      const res = await updateCompanyDocumentMetaAction(doc.id, { tags });
      if (!res.ok) {
        toast({ variant: "error", title: "Tags not saved", description: res.message });
        return;
      }
      toast({ variant: "success", title: "Tags updated" });
      router.refresh();
    });
  };

  const createFolder = () => {
    const name = newFolderName.trim();
    setNewFolderOpen(false);
    setNewFolderName("");
    if (!name) return;
    startTransition(async () => {
      const res = await createDocumentFolderAction(name, currentFolderForUpload);
      if (!res.ok) {
        toast({ variant: "error", title: "Folder not created", description: res.message });
        return;
      }
      toast({ variant: "success", title: `Folder "${name}" created` });
      router.refresh();
    });
  };

  const createNewDocument = () => {
    const title = newDocTitle.trim();
    if (!title) return;
    setNewDocOpen(false);
    startTransition(async () => {
      const res = await createBlankDocumentAction({
        title,
        category: newDocCategory as (typeof COMPANY_DOCUMENT_CATEGORIES)[number]["value"],
        folder_id: currentFolderForUpload,
        tags: newDocTags.split(",").map((t) => t.trim()).filter(Boolean),
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Could not create document", description: res.message });
        return;
      }
      toast({ variant: "success", title: `"${title}" created`, description: "Opening the editor…" });
      setNewDocTitle("");
      setNewDocTags("");
      router.push(`/files/${res.id}/edit`);
    });
  };

  const renameFolder = () => {
    if (!renameTarget) return;
    const folder = renameTarget;
    const name = renameValue.trim();
    setRenameTarget(null);
    if (!name || name === folder.name) return;
    startTransition(async () => {
      const res = await renameDocumentFolderAction(folder.id, name);
      if (!res.ok) {
        toast({ variant: "error", title: "Rename failed", description: res.message });
        return;
      }
      router.refresh();
    });
  };

  const removeFolder = (folder: DocumentFolder) => {
    startTransition(async () => {
      const res = await deleteDocumentFolderAction(folder.id);
      if (!res.ok) {
        toast({ variant: "error", title: "Delete failed", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: `Folder "${folder.name}" removed`,
        description: "Documents inside moved to All documents.",
      });
      if (folderId === folder.id) setFolderId("all");
      router.refresh();
    });
  };

  const filtersActive =
    category !== "all" || tagFilter !== "all" || kindFilter !== "all" ||
    uploaderFilter !== "all" || search.trim() !== "";

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* ---- Folder tree ---- */}
      <div className="enterprise-panel p-3 space-y-1 h-fit">
        <div className="flex items-center justify-between px-1 pb-2">
          <p className="enterprise-label normal-case tracking-normal">Folders</p>
          {canManage && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="New folder (inside the selected folder)"
              onClick={() => setNewFolderOpen(true)}
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setFolderId("all")}
          className={cn(
            "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40",
            folderId === "all" && "bg-muted/60 font-medium"
          )}
        >
          <BookOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">All documents</span>
          <span className="ml-auto text-xs text-muted-foreground">{documents.length}</span>
        </button>
        <button
          type="button"
          onClick={() => setFolderId("root")}
          onDragOver={handleFolderDragOver("root")}
          onDragLeave={() => setDropFolderId(null)}
          onDrop={handleFolderDrop(null, "root")}
          className={cn(
            "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40",
            folderId === "root" && "bg-muted/60 font-medium",
            dropFolderId === "root" && "ring-1 ring-primary bg-primary/10"
          )}
        >
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">Unfiled</span>
          <span className="ml-auto text-xs text-muted-foreground">{docCounts.get(null) ?? 0}</span>
        </button>
        {tree.map(({ folder, depth }) => {
          const active = folderId === folder.id;
          const FolderIcon = active ? FolderOpen : Folder;
          return (
            <div key={folder.id} className="group flex items-center">
              <button
                type="button"
                onClick={() => setFolderId(folder.id)}
                onDragOver={handleFolderDragOver(folder.id)}
                onDragLeave={() => setDropFolderId(null)}
                onDrop={handleFolderDrop(folder.id, folder.id)}
                className={cn(
                  "flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40 min-w-0",
                  active && "bg-muted/60 font-medium",
                  dropFolderId === folder.id && "ring-1 ring-primary bg-primary/10"
                )}
                style={{ paddingLeft: `${8 + depth * 14}px` }}
              >
                <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{folder.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {docCounts.get(folder.id) ?? 0}
                </span>
              </button>
              {canManage && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                      />
                    }
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => {
                        setRenameTarget(folder);
                        setRenameValue(folder.name);
                      }}
                    >
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => removeFolder(folder)}>
                      Delete folder
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
      </div>

      {/* ---- Main column ---- */}
      <div className="space-y-4 min-w-0">
        {canManage && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setNewDocOpen(true)}>
              <PencilLine className="mr-1.5 h-4 w-4" />
              New document
            </Button>
            <p className="flow-helper">
              Write an SOP directly in Flow — no Word file needed.
            </p>
          </div>
        )}
        {canManage && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              if (e.dataTransfer.files.length) onPickFiles(e.dataTransfer.files);
            }}
            className={cn(
              "relative flow-upload-zone p-4 text-center",
              dragOver && "flow-upload-zone-active"
            )}
          >
            {progress ? (
              <>
                <Loader2 className="h-5 w-5 mx-auto text-muted-foreground mb-1 animate-spin" />
                <p className="text-sm font-medium">
                  Uploading {progress.done}/{progress.total}…
                </p>
              </>
            ) : (
              <>
                <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-medium">
                  Drop files here — they land in{" "}
                  <span className="text-primary">
                    {currentFolderForUpload != null ? folderName(currentFolderForUpload) : "Unfiled"}
                  </span>{" "}
                  (or drop straight onto a folder)
                </p>
                <p className="flow-helper mt-1">
                  Multiple files supported · Max {formatUploadLimitLabel(clientCompanyDocumentMaxBytes)} each ·
                  PDF, DOCX, XLSX, TXT, PNG, JPG
                </p>
              </>
            )}
            <input
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,application/pdf"
              disabled={pending}
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => {
                if (e.target.files) onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {canManage && queue.length > 0 && !progress && (
          <div className="enterprise-panel p-4 space-y-3">
            <p className="text-sm font-medium">
              {queue.length} file{queue.length === 1 ? "" : "s"} ready to upload into{" "}
              <span className="text-primary">
                {queueFolderId != null ? folderName(queueFolderId) : "Unfiled"}
              </span>
            </p>
            <ul className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
              {queue.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setQueue((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="upload-category">Category (all files)</Label>
                <Select value={uploadCategory} onValueChange={(v) => v && setUploadCategory(v)}>
                  <SelectTrigger id="upload-category" className="w-full bg-card text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_DOCUMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="upload-tags">Tags (comma-separated, all files)</Label>
                <Input
                  id="upload-tags"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  placeholder="e.g. imports, qa, onboarding"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" onClick={uploadQueue} disabled={pending}>
                Upload {queue.length} file{queue.length === 1 ? "" : "s"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setQueue([])} disabled={pending}>
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* ---- Filter bar ---- */}
        <div className="enterprise-panel p-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, file name, tags…"
                className="pl-8"
              />
            </div>
            <Select value={category} onValueChange={(v) => v && setCategory(v)}>
              <SelectTrigger className="w-[130px] bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {COMPANY_DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kindFilter} onValueChange={(v) => v && setKindFilter(v)}>
              <SelectTrigger className="w-[120px] bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allTags.length > 0 && (
              <Select value={tagFilter} onValueChange={(v) => v && setTagFilter(v)}>
                <SelectTrigger className="w-[130px] bg-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tags</SelectItem>
                  {allTags.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {allUploaders.length > 1 && (
              <Select value={uploaderFilter} onValueChange={(v) => v && setUploaderFilter(v)}>
                <SelectTrigger className="w-[150px] bg-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All uploaders</SelectItem>
                  {allUploaders.map(([id, name]) => (
                    <SelectItem key={id} value={id}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filtersActive && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setCategory("all");
                  setTagFilter("all");
                  setKindFilter("all");
                  setUploaderFilter("all");
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        </div>

        {/* ---- Document table ---- */}
        {visibleDocs.length === 0 ? (
          <div className="enterprise-panel border-dashed p-10 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {documents.length === 0 ? "No company documents yet." : "Nothing matches these filters."}
            </p>
            {canManage && documents.length === 0 && (
              <p className="text-xs mt-2">Drag and drop SOPs, policies, and reference files above.</p>
            )}
          </div>
        ) : (
          <div className="enterprise-panel overflow-hidden">
            <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
              <p className="enterprise-label normal-case tracking-normal">
                {folderName(folderId === "all" || folderId === "root" ? null : folderId)}
                {folderId === "root" && " · Unfiled"}
              </p>
              <Badge variant="outline" className="text-xs">
                {visibleDocs.length} file{visibleDocs.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Document</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Tags</th>
                    <th className="px-4 py-3 font-medium">Uploaded by</th>
                    <th className="px-4 py-3 font-medium">When</th>
                    {canManage && <th className="px-4 py-3 font-medium w-12" />}
                  </tr>
                </thead>
                <tbody>
                  {visibleDocs.map((doc) => {
                    const kind = fileKind(doc);
                    const KindIcon = kindIcon(kind);
                    const edited = doc.content_updated_at != null;
                    return (
                      <tr
                        key={doc.id}
                        draggable={canManage}
                        onDragStart={(e) => {
                          e.dataTransfer.setData(DOC_DRAG_TYPE, doc.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        className={cn(
                          "border-b border-border/40 hover:bg-muted/20",
                          canManage && "cursor-grab active:cursor-grabbing"
                        )}
                        title={canManage ? "Drag onto a folder to move" : undefined}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2 min-w-0">
                            <KindIcon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={fileViewHref("company", doc.id, { employee: employeeView })}
                                  className="font-medium text-primary hover:underline truncate"
                                >
                                  {doc.title}
                                </Link>
                                {edited && (
                                  <Badge variant="outline" className="text-[10px] shrink-0">
                                    Edited in Flow
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                                {doc.file_name} · {formatFileSize(doc.file_size)} · {KIND_LABELS[kind]}
                              </p>
                              {doc.description && (
                                <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                                  {doc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="text-xs capitalize">
                            {categoryLabel(doc.category)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 max-w-[180px]">
                            {doc.tags.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              doc.tags.map((t) => (
                                <Badge
                                  key={t}
                                  variant="outline"
                                  className="text-[10px] cursor-pointer"
                                  onClick={() => setTagFilter(t)}
                                >
                                  {t}
                                </Badge>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">{doc.uploaded_by_name}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {format(new Date(doc.created_at), "MMM d, yyyy")}
                        </td>
                        {canManage && (
                          <td className="px-4 py-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                render={
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground"
                                    disabled={pending}
                                  />
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {isEditableInFlow(doc) && (
                                  <DropdownMenuItem
                                    render={<Link href={`/files/${doc.id}/edit`} prefetch={false} />}
                                  >
                                    <PencilLine className="mr-2 h-4 w-4" />
                                    Edit in Flow
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                  onClick={() => {
                                    setTagTarget(doc);
                                    setTagValue(doc.tags.join(", "));
                                  }}
                                >
                                  <Tag className="mr-2 h-4 w-4" />
                                  Edit tags
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuGroup>
                                  <DropdownMenuLabel className="text-xs">Move to</DropdownMenuLabel>
                                  {doc.folder_id != null && (
                                    <DropdownMenuItem onClick={() => moveDoc(doc, null)}>
                                      <Folder className="mr-2 h-4 w-4" />
                                      Unfiled
                                    </DropdownMenuItem>
                                  )}
                                  {tree
                                    .filter(({ folder }) => folder.id !== doc.folder_id)
                                    .map(({ folder, depth }) => (
                                      <DropdownMenuItem
                                        key={folder.id}
                                        onClick={() => moveDoc(doc, folder.id)}
                                      >
                                        <Folder className="mr-2 h-4 w-4" />
                                        <span style={{ paddingLeft: `${depth * 10}px` }}>
                                          {folder.name}
                                        </span>
                                      </DropdownMenuItem>
                                    ))}
                                </DropdownMenuGroup>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => {
                                    startTransition(async () => {
                                      const res = await deleteCompanyDocumentAction(doc.id);
                                      if (!res.ok) {
                                        toast({
                                          variant: "error",
                                          title: "Delete failed",
                                          description: res.message,
                                        });
                                        return;
                                      }
                                      toast({ variant: "success", title: "Document removed" });
                                      router.refresh();
                                    });
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ---- Dialogs ---- */}
      <Dialog open={newDocOpen} onOpenChange={setNewDocOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New document</DialogTitle>
            <DialogDescription>
              Authored in Flow — it opens straight in the editor and lands in{" "}
              {folderName(currentFolderForUpload) === "All documents"
                ? "Unfiled"
                : folderName(currentFolderForUpload)}
              .
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-doc-title">Title</Label>
              <Input
                id="new-doc-title"
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
                placeholder="e.g. SOP — Handling import corrections"
                onKeyDown={(e) => {
                  if (e.key === "Enter") createNewDocument();
                }}
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="new-doc-category">Category</Label>
                <Select value={newDocCategory} onValueChange={(v) => v && setNewDocCategory(v)}>
                  <SelectTrigger id="new-doc-category" className="w-full bg-card text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_DOCUMENT_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-doc-tags">Tags (comma-separated)</Label>
                <Input
                  id="new-doc-tags"
                  value={newDocTags}
                  onChange={(e) => setNewDocTags(e.target.value)}
                  placeholder="e.g. imports, qa"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewDocOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={createNewDocument}
              disabled={!newDocTitle.trim() || pending}
            >
              Create & edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Created inside {folderName(currentFolderForUpload)}.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="e.g. SOPs — Imports"
            onKeyDown={(e) => {
              if (e.key === "Enter") createFolder();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewFolderOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={createFolder} disabled={!newFolderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") renameFolder();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={renameFolder} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={tagTarget !== null} onOpenChange={(open) => !open && setTagTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit tags</DialogTitle>
            <DialogDescription>Comma-separated. Tags power the filter bar.</DialogDescription>
          </DialogHeader>
          <Input
            value={tagValue}
            onChange={(e) => setTagValue(e.target.value)}
            placeholder="e.g. imports, qa, onboarding"
            onKeyDown={(e) => {
              if (e.key === "Enter") saveTags();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTagTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveTags}>
              Save tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
