"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  askEddyAction,
  getEddyThreadAction,
  newEddyChatAction,
} from "@/app/actions/eddy";
import type { EddyMessage } from "@/lib/eddy/conversations";
import { AI_NAME } from "@/lib/ai/brand";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArrowRight, Loader2, Plus, Send, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "How do I submit a batch to QA?",
  "What's on this page?",
  "How do I run a library audit?",
];

export function AskEddyBubble() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [messages, setMessages] = useState<EddyMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [contextLabel, setContextLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Your history, loaded once per open — strictly your own thread.
  useEffect(() => {
    if (!open || loaded) return;
    startTransition(async () => {
      const res = await getEddyThreadAction();
      if (res.ok) setMessages(res.messages);
      setLoaded(true);
    });
  }, [open, loaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, pending]);

  function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setError(null);
    setDraft("");
    // Optimistic echo so the thread feels alive while Eddy thinks.
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        conversation_id: "",
        user_id: "",
        role: "user",
        content: message,
        sources: null,
        page_path: pathname,
        created_at: new Date().toISOString(),
      },
    ]);
    startTransition(async () => {
      const res = await askEddyAction({ message, pathname });
      if (!res.ok) {
        setError(res.message ?? "Eddy hit a snag — try again");
        return;
      }
      setMessages(res.messages);
      setContextLabel(res.contextLabel ?? null);
    });
  }

  function newChat() {
    startTransition(async () => {
      const res = await newEddyChatAction();
      if (res.ok) {
        setMessages([]);
        setContextLabel(null);
        setError(null);
      }
    });
  }

  const lastSources = [...messages].reverse().find((m) => m.role === "assistant" && m.sources?.length)?.sources;

  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon"
              aria-label={`Ask ${AI_NAME}`}
              onClick={() => setOpen(true)}
              className={cn(
                "fixed z-40 h-11 w-11 rounded-full shadow-lg",
                "border border-border/60 bg-card text-primary",
                "hover:bg-primary/10 hover:border-primary/30",
                "bottom-[8.25rem] right-4 sm:bottom-[4.75rem] sm:right-6"
              )}
            />
          }
        >
          <Sparkles className="h-5 w-5" />
        </TooltipTrigger>
        <TooltipContent side="left">{`Ask ${AI_NAME}`}</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {`Ask ${AI_NAME}`}
                </DialogTitle>
                <DialogDescription>
                  {contextLabel
                    ? `${AI_NAME} can see this page: ${contextLabel}. Your chats are yours alone.`
                    : `${AI_NAME} remembers your conversation — yours alone, nobody else's.`}
                </DialogDescription>
              </div>
              {messages.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-muted-foreground"
                  disabled={pending}
                  onClick={newChat}
                  title="Start a fresh conversation"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New chat
                </Button>
              )}
            </div>
          </DialogHeader>

          {messages.length > 0 && (
            <div ref={scrollRef} className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "whitespace-pre-wrap rounded-md px-3 py-2 text-sm",
                    m.role === "user"
                      ? "ml-8 bg-primary/10 border border-primary/20"
                      : "mr-8 bg-muted/20 border border-border/50"
                  )}
                >
                  {m.content}
                </div>
              ))}
              {pending && (
                <div className="mr-8 flex items-center gap-2 rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {`${AI_NAME} is thinking…`}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          {messages.length === 0 && !pending && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={messages.length === 0 ? "How do I…?" : "Reply…"}
              autoFocus
            />
            <Button type="submit" size="icon" disabled={pending || !draft.trim()}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {lastSources && lastSources.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {lastSources.map((source, i) => (
                <Link
                  key={i}
                  href={`/docs/${source.slug}`}
                  prefetch={false}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {source.title} — {source.heading}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
