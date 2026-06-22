"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  deleteCompanyDocumentAction,
  uploadCompanyDocumentAction,
} from "@/app/actions/company-documents";
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
import { useFlowToast } from "@/components/ui/flow-toast";
import { COMPANY_DOCUMENT_CATEGORIES } from "@/lib/files/company-document-categories";
import { fileViewHref } from "@/lib/files/download";
import { cn } from "@/lib/utils";
import type { CompanyDocumentView } from "@/types/flow";
import { format } from "date-fns";
import { BookOpen, FileText, Loader2, Trash2, Upload } from "lucide-react";

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function categoryLabel(category: string) {
  return COMPANY_DOCUMENT_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export function CompanyDocumentsPanel({
  documents,
  canManage,
  employeeView = false,
}: {
  documents: CompanyDocumentView[];
  canManage: boolean;
  employeeView?: boolean;
}) {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [pending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("sop");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const upload = useCallback(() => {
    if (!selectedFile) {
      toast({ variant: "error", title: "Choose a file", description: "Select a document to upload." });
      return;
    }
    if (!title.trim()) {
      toast({ variant: "error", title: "Title required", description: "Add a title for this document." });
      return;
    }

    const fd = new FormData();
    fd.set("title", title.trim());
    fd.set("description", description.trim());
    fd.set("category", category);
    fd.set("file", selectedFile);

    startTransition(async () => {
      const res = await uploadCompanyDocumentAction(fd);
      if (!res.ok) {
        toast({ variant: "error", title: "Upload failed", description: res.message });
        return;
      }
      toast({ variant: "success", title: "Document uploaded", description: title.trim() });
      setTitle("");
      setDescription("");
      setCategory("sop");
      setSelectedFile(null);
      router.refresh();
    });
  }, [category, description, router, selectedFile, title, toast]);

  const onPickFiles = useCallback((fileList: FileList | File[]) => {
    const file = Array.from(fileList)[0];
    if (!file) return;
    setSelectedFile(file);
    if (!title.trim()) {
      const base = file.name.replace(/\.[^.]+$/, "");
      setTitle(base);
    }
  }, [title]);

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="enterprise-panel p-4 space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Upload SOP or company document</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doc-title">Title</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wire harness inspection SOP"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doc-category">Category</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger id="doc-category" className="w-full bg-card text-foreground">
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="doc-description">Description (optional)</Label>
            <Input
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="When to use this document"
            />
          </div>

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
              "relative flow-upload-zone p-5 text-center",
              dragOver && "flow-upload-zone-active"
            )}
          >
            {pending ? (
              <Loader2 className="h-5 w-5 mx-auto text-muted-foreground mb-2 animate-spin" />
            ) : (
              <Upload className="h-5 w-5 mx-auto text-muted-foreground mb-2" />
            )}
            <p className="text-sm font-medium">
              {selectedFile ? selectedFile.name : "Drop PDF, Word, Excel, or image here"}
            </p>
            <p className="flow-helper mt-1">Max 25 MB · PDF, DOCX, XLSX, TXT, PNG, JPG</p>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg,.webp,application/pdf"
              disabled={pending}
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => {
                if (e.target.files) onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <Button type="button" onClick={upload} disabled={pending || !selectedFile} className="w-full sm:w-auto">
            {pending ? "Uploading…" : "Upload document"}
          </Button>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="enterprise-panel border-dashed p-10 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No company documents yet.</p>
          {canManage && (
            <p className="text-xs mt-2">Upload SOPs, policies, and reference files for your team.</p>
          )}
        </div>
      ) : (
        <div className="enterprise-panel overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-secondary/50 flex items-center justify-between">
            <p className="enterprise-label normal-case tracking-normal">Company documents</p>
            <Badge variant="outline" className="text-xs">
              {documents.length} file{documents.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Document</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Uploaded by</th>
                  <th className="px-4 py-3 font-medium">When</th>
                  {canManage && <th className="px-4 py-3 font-medium w-12" />}
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id} className="border-b border-border/40 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <Link
                        href={fileViewHref("company", doc.id, { employee: employeeView })}
                        className="font-medium text-primary hover:underline"
                      >
                        {doc.title}
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                        {doc.file_name} · {formatFileSize(doc.file_size)}
                      </p>
                      {doc.description && (
                        <p className="text-xs text-muted-foreground mt-1">{doc.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-xs capitalize">
                        {categoryLabel(doc.category)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{doc.uploaded_by_name}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {format(new Date(doc.created_at), "MMM d, yyyy")}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          disabled={pending}
                          onClick={() => {
                            startTransition(async () => {
                              const res = await deleteCompanyDocumentAction(doc.id);
                              if (!res.ok) {
                                toast({ variant: "error", title: "Delete failed", description: res.message });
                                return;
                              }
                              toast({ variant: "success", title: "Document removed" });
                              router.refresh();
                            });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
