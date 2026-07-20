"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveTaskBuilderDraftAction,
  taskBuilderTurnAction,
} from "@/app/actions/eddy-task-builder";
import { AI_NAME } from "@/lib/ai/brand";
import {
  TASK_BUILDER_MAX_TURNS,
  type TaskBuilderDraft,
  type TaskBuilderMessage,
} from "@/lib/eddy/task-builder";
import { useFlowToast } from "@/components/ui/flow-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  WizardDialogBody,
  WizardDialogContent,
  WizardDialogFooter,
  WizardDialogHeader,
  WizardDialogScroll,
} from "@/components/ui/wizard-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles } from "lucide-react";

interface ThreadMessage extends TaskBuilderMessage {
  /** Draft turns keep raw JSON as content (so Eddy can revise it) but render preview lines. */
  previewLines?: string[];
}

interface DraftState {
  draft: TaskBuilderDraft;
  previewLines: string[];
  summary?: string;
}

const GREETING =
  "What do you need to get done? Tell me in your own words — who it's for, " +
  "what kind of work, how much. I'll ask a couple of questions and set it up properly.";

export function EddyTaskBuilderDialog({
  trigger,
}: {
  trigger?: React.ReactElement | null;
}) {
  const { toast } = useFlowToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [input, setInput] = useState("");
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [thinking, setThinking] = useState(false);
  const [approving, startApprove] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  const turnsLeft = TASK_BUILDER_MAX_TURNS - messages.length;

  function reset() {
    setMessages([]);
    setInput("");
    setDraftState(null);
    setThinking(false);
  }

  function scrollToEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    const next: ThreadMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setDraftState(null);
    setThinking(true);
    scrollToEnd();
    try {
      const res = await taskBuilderTurnAction({
        messages: next.map(({ role, content }) => ({ role, content })),
      });
      if (!res.ok || !res.turn) {
        toast({
          variant: "error",
          title: `${AI_NAME} couldn't answer`,
          description: res.message ?? "Try again.",
        });
        setMessages(messages);
        return;
      }
      if (res.turn.type === "question") {
        setMessages([
          ...next,
          { role: "assistant", content: res.turn.question ?? "" },
        ]);
      } else if (res.turn.draft) {
        const previewLines = res.previewLines ?? [];
        setMessages([
          ...next,
          {
            role: "assistant",
            content: JSON.stringify({ summary: res.turn.summary, draft: res.turn.draft }),
            previewLines,
          },
        ]);
        setDraftState({
          draft: res.turn.draft,
          previewLines,
          summary: res.turn.summary,
        });
      }
      scrollToEnd();
    } finally {
      setThinking(false);
    }
  }

  function approve() {
    if (!draftState) return;
    startApprove(async () => {
      const res = await approveTaskBuilderDraftAction(draftState.draft);
      if (!res.ok) {
        toast({
          variant: "error",
          title: "Could not create the work",
          description: res.message,
        });
        return;
      }
      toast({
        variant: "success",
        title:
          res.createdTasks > 0
            ? `Created ${res.createdTasks} task${res.createdTasks === 1 ? "" : "s"}`
            : "Project created",
        description: draftState.summary,
      });
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger
        render={
          trigger ?? (
            <Button size="sm" variant="outline" className="h-8">
              <Sparkles className="h-3.5 w-3.5 mr-1.5 text-primary" />
              Add with {AI_NAME}
            </Button>
          )
        }
      />
      <WizardDialogContent size="lg">
        <WizardDialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Build work with {AI_NAME}
          </DialogTitle>
          <p className="text-sm text-muted-foreground pt-1">
            Describe the work in plain English — {AI_NAME} asks what he needs, then
            shows exactly what will be created. Nothing is created until you approve.
          </p>
        </WizardDialogHeader>
        <WizardDialogBody>
          <WizardDialogScroll ref={scrollRef} className="space-y-3 pr-1">
            <ThreadBubble role="assistant">{GREETING}</ThreadBubble>
            {messages.map((m, i) =>
              m.previewLines ? (
                <div
                  key={i}
                  className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                    {AI_NAME}&apos;s draft — will create
                  </p>
                  <div className="space-y-1">
                    {m.previewLines.map((line, j) => (
                      <p
                        key={j}
                        className={
                          j === 0
                            ? "font-medium"
                            : "text-xs text-muted-foreground font-mono"
                        }
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              ) : (
                <ThreadBubble key={i} role={m.role}>
                  {m.content}
                </ThreadBubble>
              )
            )}
            {thinking && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {AI_NAME} is thinking…
              </div>
            )}
            {draftState && (
              <p className="text-xs text-muted-foreground">
                Not quite right? Just tell {AI_NAME} what to change.
              </p>
            )}
          </WizardDialogScroll>
        </WizardDialogBody>
        <WizardDialogFooter>
          <div className="flex w-full flex-col gap-2">
            {turnsLeft <= 0 ? (
              <p className="text-xs text-muted-foreground">
                This conversation got long — close and start fresh.
              </p>
            ) : (
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                rows={2}
                placeholder={
                  draftState
                    ? `Tell ${AI_NAME} what to change…`
                    : 'e.g. "Deleathia needs 40 name-edit files done by Friday"'
                }
                disabled={thinking || approving}
              />
            )}
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={approving}
              >
                Cancel
              </Button>
              {draftState ? (
                <Button type="button" onClick={approve} disabled={approving || thinking}>
                  {approving ? "Creating…" : "Approve & create"}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => void send()}
                  disabled={thinking || !input.trim() || turnsLeft <= 0}
                >
                  {thinking ? "Thinking…" : "Send"}
                </Button>
              )}
            </div>
          </div>
        </WizardDialogFooter>
      </WizardDialogContent>
    </Dialog>
  );
}

function ThreadBubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-md bg-primary/10 px-3 py-2 text-sm whitespace-pre-wrap">
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-[92%]">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
        {AI_NAME}
      </p>
      <div className="rounded-md border bg-muted/10 px-3 py-2 text-sm whitespace-pre-wrap">
        {children}
      </div>
    </div>
  );
}
