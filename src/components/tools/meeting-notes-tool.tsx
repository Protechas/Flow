"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createQuickTaskAction } from "@/app/actions/crud";
import {
  eddyMeetingDigestAction,
  saveMeetingNotesAction,
} from "@/app/actions/meeting-notes";
import { AI_NAME } from "@/lib/ai/brand";
import type { EddyMeetingDigest } from "@/lib/ai/meeting-notes";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { WORK_PRIORITIES } from "@/lib/constants";
import type { WorkPriority } from "@/types/flow";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  NotebookPen,
  Sparkles,
} from "lucide-react";

interface NamedOption {
  id: string;
  name: string;
}

interface ActionItemDraft {
  checked: boolean;
  title: string;
  detail?: string;
  assigneeId: string;
  due: string;
  priority: WorkPriority;
  suggestedAssignee?: string;
}

function localToday(): string {
  return new Date().toLocaleDateString("en-CA");
}

/** Match "Deryk" / "Deryk S." as spoken in the meeting to a roster person. */
function matchAssignee(suggestion: string | undefined, assignees: NamedOption[]): string {
  if (!suggestion) return "";
  const s = suggestion.trim().toLowerCase();
  if (!s) return "";
  const exact = assignees.find((a) => a.name.toLowerCase() === s);
  if (exact) return exact.id;
  const first = assignees.find((a) => a.name.toLowerCase().split(" ")[0] === s.split(" ")[0]);
  if (first) return first.id;
  const contains = assignees.find(
    (a) => a.name.toLowerCase().includes(s) || s.includes(a.name.toLowerCase().split(" ")[0])
  );
  return contains?.id ?? "";
}

export function MeetingNotesTool({
  projects,
  assignees,
}: {
  projects: NamedOption[];
  assignees: NamedOption[];
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(localToday());
  const [attendees, setAttendees] = useState("");
  const [transcript, setTranscript] = useState("");
  const [digesting, setDigesting] = useState(false);
  const [digest, setDigest] = useState<EddyMeetingDigest | null>(null);
  const [items, setItems] = useState<ActionItemDraft[]>([]);
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const checkedCount = useMemo(() => items.filter((i) => i.checked && i.title.trim()).length, [items]);

  async function digestTranscript() {
    setDigesting(true);
    setMessage(null);
    setSavedDocId(null);
    try {
      const res = await eddyMeetingDigestAction({ transcript, title, date });
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      setDigest(res.digest);
      setItems(
        res.digest.actionItems.map((a) => ({
          checked: true,
          title: a.title,
          detail: a.detail,
          assigneeId: matchAssignee(a.suggestedAssignee, assignees),
          due: a.due ?? "",
          priority: a.priority,
          suggestedAssignee: a.suggestedAssignee,
        }))
      );
    } finally {
      setDigesting(false);
    }
  }

  async function saveNotes() {
    if (!digest) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await saveMeetingNotesAction({
        title: title.trim() || "Team meeting",
        date,
        attendees: attendees.trim() || undefined,
        digest,
      });
      if (!res.ok) {
        setMessage(res.message);
        return;
      }
      setSavedDocId(res.documentId);
    } finally {
      setSaving(false);
    }
  }

  async function createTasks() {
    if (!projectId || checkedCount === 0) return;
    setCreating(true);
    setMessage(null);
    let created = 0;
    const approved = items.filter((i) => i.checked && i.title.trim());
    for (const item of approved) {
      try {
        await createQuickTaskAction({
          projectId,
          manufacturerName: "Meeting Notes",
          taskTitle: item.title.trim(),
          assignedTo: item.assigneeId || null,
          priority: item.priority,
          manualDueDate: item.due || null,
          notes: [
            item.detail,
            `(From "${title.trim() || "Team meeting"}" ${date} — drafted by ${AI_NAME}, approved by a lead.)`,
          ]
            .filter(Boolean)
            .join("\n\n"),
        });
        created++;
      } catch {
        // keep going; report the total honestly below
      }
    }
    setCreating(false);
    setMessage(
      `Created ${created} of ${approved.length} task${approved.length === 1 ? "" : "s"} in ${
        projects.find((p) => p.id === projectId)?.name ?? "the project"
      }.`
    );
    setItems((prev) => prev.filter((i) => !(i.checked && i.title.trim())));
  }

  function updateItem(index: number, patch: Partial<ActionItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  return (
    <div className="space-y-6">
      <div className="enterprise-panel p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <Label>Meeting title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Managers meeting"
            />
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Attendees (optional)</Label>
            <Input
              value={attendees}
              onChange={(e) => setAttendees(e.target.value)}
              placeholder="Dusty, Christopher, Zachary…"
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Transcript</Label>
          <Textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={10}
            placeholder="Paste the Teams transcript (or your raw meeting notes) here…"
          />
          <p className="text-xs text-muted-foreground">
            The transcript is sent to {AI_NAME} once when you click the button and is never
            stored — only the notes you choose to save land in Files.
          </p>
        </div>
        <Button onClick={digestTranscript} disabled={digesting || transcript.trim().length < 80}>
          {digesting ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              {AI_NAME} is reading the meeting…
            </>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-4 w-4" />
              Digest with {AI_NAME} (~2-5¢)
            </>
          )}
        </Button>
      </div>

      {message && <p className="text-sm text-muted-foreground px-1">{message}</p>}

      {digest && (
        <div className="enterprise-panel p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <NotebookPen className="h-4 w-4 text-primary" />
              {title.trim() || "Team meeting"} — {date}
            </h2>
            <div className="flex items-center gap-2">
              {savedDocId ? (
                <Button size="sm" variant="outline" render={<Link href="/files" />}>
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                  Saved — open Files
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={saveNotes} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Save notes to Files
                </Button>
              )}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Summary</p>
            <p className="text-sm">{digest.summary}</p>
          </div>

          {digest.decisions.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                Decisions
              </p>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {digest.decisions.map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}

          {items.length > 0 ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Action items — approve to create tasks
              </p>
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <li key={i} className="rounded-md border bg-muted/10 p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Checkbox
                        checked={item.checked}
                        onCheckedChange={(c) => updateItem(i, { checked: Boolean(c) })}
                        className="mt-1.5"
                      />
                      <div className="flex-1 space-y-2">
                        <Input
                          value={item.title}
                          onChange={(e) => updateItem(i, { title: e.target.value })}
                        />
                        {item.detail && (
                          <p className="text-xs text-muted-foreground">{item.detail}</p>
                        )}
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Select
                            value={item.assigneeId || "__none__"}
                            onValueChange={(v) =>
                              updateItem(i, { assigneeId: v === "__none__" ? "" : (v ?? "") })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Unassigned" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                Unassigned
                                {item.suggestedAssignee && !item.assigneeId
                                  ? ` (heard: ${item.suggestedAssignee})`
                                  : ""}
                              </SelectItem>
                              {assignees.map((a) => (
                                <SelectItem key={a.id} value={a.id}>
                                  {a.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            type="date"
                            value={item.due}
                            onChange={(e) => updateItem(i, { due: e.target.value })}
                          />
                          <Select
                            value={item.priority}
                            onValueChange={(v) =>
                              v && updateItem(i, { priority: v as WorkPriority })
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WORK_PRIORITIES.map((p) => (
                                <SelectItem key={p.value} value={p.value}>
                                  {p.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={projectId} onValueChange={(v) => v && setProjectId(v)}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Project for these tasks *" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={createTasks} disabled={creating || !projectId || checkedCount === 0}>
                  {creating
                    ? "Creating…"
                    : `Create ${checkedCount} task${checkedCount === 1 ? "" : "s"}`}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Nothing exists until you approve — uncheck anything that shouldn&apos;t become
                  a task.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No action items {digest.actionItems.length > 0 ? "left to approve" : "found in this meeting"}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
