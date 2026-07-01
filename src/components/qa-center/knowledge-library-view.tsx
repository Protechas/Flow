"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  activateKnowledgeVersionAction,
  createKnowledgeEntryAction,
  listKnowledgeVersionsAction,
  uploadKnowledgeDocumentAction,
} from "@/app/actions/qa-center";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useFlowToast } from "@/components/ui/flow-toast";
import {
  QA_KNOWLEDGE_ACCEPTED_EXTENSIONS,
  QA_KNOWLEDGE_CATEGORY_OPTIONS,
} from "@/lib/qa-center/knowledge/catalog";
import {
  QA_KNOWLEDGE_CATEGORY_LABELS,
  type QaKnowledgeCategory,
  type QaKnowledgeEntry,
  type QaKnowledgeVersion,
} from "@/lib/qa-center/types";
import type { KnowledgeLibraryStatus } from "@/lib/qa-center/knowledge/status";
import {
  clientQaKnowledgeMaxBytes,
  formatUploadLimitLabel,
} from "@/lib/files/upload-limits-client";
import { BookOpen, Download, History, Loader2, Search, Upload } from "lucide-react";

function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function KnowledgeLibraryView({
  entries,
  mcManufacturers,
  canManage,
  libraryStatus,
}: {
  entries: QaKnowledgeEntry[];
  mcManufacturers: string[];
  canManage: boolean;
  libraryStatus: KnowledgeLibraryStatus;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [uploadEntryId, setUploadEntryId] = useState(entries[0]?.id ?? "");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<QaKnowledgeCategory>("other");
  const [newDescription, setNewDescription] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.description ?? "").toLowerCase().includes(q) ||
        QA_KNOWLEDGE_CATEGORY_LABELS[e.category].toLowerCase().includes(q) ||
        e.tags.some((t) => t.toLowerCase().includes(q)) ||
        (e.index_metadata?.manufacturers ?? []).some((m) => m.toLowerCase().includes(q))
    );
  }, [entries, query]);

  const loadedCount = entries.filter((e) => e.active_version?.storage_path).length;

  const onPickFiles = useCallback((fileList: FileList | File[]) => {
    const file = Array.from(fileList)[0];
    if (file) setUploadFile(file);
  }, []);

  const handleUpload = useCallback(() => {
    if (!uploadEntryId) {
      toast({ variant: "error", title: "Select entry", description: "Choose which library slot to update." });
      return;
    }
    if (!uploadFile) {
      toast({ variant: "error", title: "Choose a file", description: "Select a reference document to upload." });
      return;
    }

    const fd = new FormData();
    fd.set("entryId", uploadEntryId);
    fd.set("file", uploadFile);
    fd.set("changeNotes", changeNotes);
    fd.set("setActive", "true");

    startTransition(async () => {
      const res = await uploadKnowledgeDocumentAction(fd);
      if (!res.ok) {
        toast({ variant: "error", title: "Upload failed", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: "Reference uploaded",
        description: "Active version updated — QA engine will use this document.",
      });
      setUploadFile(null);
      setChangeNotes("");
      router.refresh();
    });
  }, [changeNotes, router, toast, uploadEntryId, uploadFile]);

  const handleCreateEntry = useCallback(() => {
    if (!newTitle.trim()) {
      toast({ variant: "error", title: "Title required", description: "Name the reference document." });
      return;
    }
    startTransition(async () => {
      const res = await createKnowledgeEntryAction({
        category: newCategory,
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Could not create entry", description: res.message });
        return;
      }
      toast({ variant: "success", title: "Entry created", description: newTitle.trim() });
      if (res.entryId) setUploadEntryId(res.entryId);
      setShowNewEntry(false);
      setNewTitle("");
      setNewDescription("");
      router.refresh();
    });
  }, [newCategory, newDescription, newTitle, router, toast]);

  return (
    <>
      <QaCenterSubnav />

      {!libraryStatus.readyForValidation && (
        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            Reference documents missing for full validation
          </p>
          <p className="text-muted-foreground mt-1">
            Upload active versions for: {libraryStatus.missingCritical.join(", ")}.{" "}
            {libraryStatus.referenceFilesOnDisk} of {libraryStatus.referenceManifestTotal} bundled
            reference files found on disk — run sync if you have Protech docs locally.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Knowledge Library
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl mt-1">
            Authoritative reference for QA validation. Upload SOPs, manufacturer charts, acronyms,
            ID³/PCS workbooks, and training docs — the engine always reads active versions here,
            never hardcoded rules.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {loadedCount} of {entries.length} entries active
            {mcManufacturers.length > 0 ? ` · ${mcManufacturers.length} OEM charts indexed` : ""}
          </p>
        </div>
      </div>

      {canManage && (
        <div className="enterprise-panel p-4 mb-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Upload reference document
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setShowNewEntry((v) => !v)}>
              {showNewEntry ? "Cancel new entry" : "New library entry"}
            </Button>
          </div>

          {showNewEntry && (
            <div className="grid gap-3 sm:grid-cols-2 border border-border/60 rounded-lg p-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Category</Label>
                <Select
                  value={newCategory}
                  onValueChange={(v) => v && setNewCategory(v as QaKnowledgeCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QA_KNOWLEDGE_CATEGORY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="sm:col-span-2">
                <Button size="sm" onClick={handleCreateEntry} disabled={pending}>
                  Create entry
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Library entry</Label>
                <Select
                  value={uploadEntryId}
                  onValueChange={(v) => v && setUploadEntryId(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select entry" />
                  </SelectTrigger>
                  <SelectContent>
                    {entries.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.title}
                        {e.active_version ? " (replace active)" : " (first upload)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Version notes</Label>
                <Input
                  value={changeNotes}
                  onChange={(e) => setChangeNotes(e.target.value)}
                  placeholder="e.g. Updated July 2022 SOP"
                />
              </div>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center min-w-[220px] transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border/60"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onPickFiles(e.dataTransfer.files);
              }}
            >
              <p className="text-sm font-medium">Drop file here</p>
              <p className="text-xs text-muted-foreground mt-1">
                {QA_KNOWLEDGE_ACCEPTED_EXTENSIONS.join(" · ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Max {formatUploadLimitLabel(clientQaKnowledgeMaxBytes)}
              </p>
              <label className="inline-block mt-3">
                <Button size="sm" variant="outline" type="button" render={<span />}>
                  Browse
                </Button>
                <input
                  type="file"
                  className="sr-only"
                  accept={QA_KNOWLEDGE_ACCEPTED_EXTENSIONS.join(",")}
                  onChange={(e) => e.target.files && onPickFiles(e.target.files)}
                />
              </label>
              {uploadFile ? (
                <p className="text-xs mt-2 text-primary truncate max-w-[200px] mx-auto">
                  {uploadFile.name}
                </p>
              ) : null}
            </div>
          </div>

          <Button onClick={handleUpload} disabled={pending || !uploadFile}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Upload & set active
          </Button>
        </div>
      )}

      <div className="relative max-w-md mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents, SOPs, manufacturers…"
          className="pl-9"
        />
      </div>

      <div className="grid gap-3">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center enterprise-panel">
            No knowledge entries match your search.
          </p>
        ) : (
          filtered.map((entry) => (
            <KnowledgeEntryCard
              key={entry.id}
              entry={entry}
              mcManufacturers={entry.category === "manufacturer_component_chart" ? mcManufacturers : []}
              canManage={canManage}
            />
          ))
        )}
      </div>
    </>
  );
}

function KnowledgeEntryCard({
  entry,
  mcManufacturers,
  canManage,
}: {
  entry: QaKnowledgeEntry;
  mcManufacturers: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versions, setVersions] = useState<QaKnowledgeVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const openHistory = useCallback(() => {
    setHistoryOpen(true);
    setLoadingVersions(true);
    startTransition(async () => {
      const rows = await listKnowledgeVersionsAction(entry.id);
      setVersions(rows);
      setLoadingVersions(false);
    });
  }, [entry.id]);

  return (
    <>
    <article className="enterprise-panel p-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <h3 className="font-medium">{entry.title}</h3>
          <Badge variant="outline" className="text-[10px]">
            {QA_KNOWLEDGE_CATEGORY_LABELS[entry.category]}
          </Badge>
          {entry.active_version?.storage_path ? (
            <Badge variant="secondary" className="text-[10px]">
              Active v{entry.active_version.version_number}
            </Badge>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{entry.description}</p>
        {entry.active_version ? (
          <p className="text-xs text-muted-foreground mt-2">
            {entry.active_version.file_name} · {formatFileSize(entry.active_version.file_size)}
            {entry.active_version.change_notes ? ` · ${entry.active_version.change_notes}` : ""}
          </p>
        ) : (
          <p className="text-xs text-amber-600/90 mt-2">No active version — upload required for validation</p>
        )}
        {mcManufacturers.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1 max-h-24 overflow-y-auto flow-sidebar-scroll">
            {mcManufacturers.map((mfg) => (
              <Badge key={mfg} variant="outline" className="text-[10px] font-normal">
                {mfg}
              </Badge>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Button size="sm" variant="ghost" onClick={openHistory}>
          <History className="h-4 w-4 mr-1" />
          Version history
        </Button>
        {entry.active_version?.id ? (
          <Button
            size="sm"
            variant="outline"
            render={
              <Link
                href={`/api/qa-center/knowledge/${entry.active_version.id}`}
                target="_blank"
                rel="noopener noreferrer"
              />
            }
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        ) : null}
        {canManage && entry.active_version && !entry.active_version.is_active ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const res = await activateKnowledgeVersionAction(entry.active_version!.id);
                if (!res.ok) {
                  toast({ variant: "error", title: "Failed", description: res.message });
                  return;
                }
                router.refresh();
              });
            }}
          >
            <History className="h-4 w-4 mr-1" />
            Set active
          </Button>
        ) : null}
      </div>
    </article>

    <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{entry.title}</SheetTitle>
          <SheetDescription>Version history and rollback</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {loadingVersions ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading versions…
            </p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions uploaded yet.</p>
          ) : (
            versions.map((version) => (
              <div
                key={version.id}
                className="rounded-lg border border-border/60 p-3 space-y-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      v{version.version_number}
                      {version.is_active ? " · Active" : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {version.file_name ?? "No file"} · {formatFileSize(version.file_size)}
                    </p>
                    {version.change_notes ? (
                      <p className="text-xs text-muted-foreground mt-1">{version.change_notes}</p>
                    ) : null}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(version.uploaded_at).toLocaleString()}
                    </p>
                  </div>
                  {version.is_active ? (
                    <Badge variant="secondary" className="text-[10px]">
                      Active
                    </Badge>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {version.storage_path ? (
                    <Button
                      size="sm"
                      variant="outline"
                      render={
                        <Link
                          href={`/api/qa-center/knowledge/${version.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  ) : null}
                  {canManage && !version.is_active && version.storage_path ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => {
                        startTransition(async () => {
                          const res = await activateKnowledgeVersionAction(version.id);
                          if (!res.ok) {
                            toast({ variant: "error", title: "Failed", description: res.message });
                            return;
                          }
                          toast({
                            variant: "success",
                            title: "Version activated",
                            description: `v${version.version_number} is now active.`,
                          });
                          setHistoryOpen(false);
                          router.refresh();
                        });
                      }}
                    >
                      Set active
                    </Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}
