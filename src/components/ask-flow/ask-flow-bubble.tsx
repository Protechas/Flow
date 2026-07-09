"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { askFlowAction, type AskFlowResult } from "@/app/actions/ask-flow";
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
import { ArrowRight, HelpCircle, Loader2, Search } from "lucide-react";

const SUGGESTIONS = [
  "How do I submit a batch to QA?",
  "Why can't I clock out?",
  "How do I run a library audit?",
];

export function AskFlowBubble() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<AskFlowResult | null>(null);
  const [pending, startTransition] = useTransition();

  function ask(q: string) {
    if (!q.trim() || pending) return;
    setQuestion(q);
    startTransition(async () => {
      setResult(await askFlowAction(q));
    });
  }

  return (
    <TooltipProvider delay={300}>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              size="icon"
              aria-label="Ask Flow"
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
          <HelpCircle className="h-5 w-5" />
        </TooltipTrigger>
        <TooltipContent side="left">Ask Flow — how do I…?</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Ask Flow
            </DialogTitle>
            <DialogDescription>
              Answers come straight from the operations manual.
            </DialogDescription>
          </DialogHeader>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              ask(question);
            }}
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How do I…?"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={pending || !question.trim()}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </form>

          {!result && !pending && (
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {result && (
            <div className="max-h-96 space-y-3 overflow-y-auto">
              {result.answer && (
                <p className="whitespace-pre-wrap rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  {result.answer}
                </p>
              )}
              {result.message && !result.answer && (
                <p className="text-sm text-muted-foreground">{result.message}</p>
              )}
              {result.sources.map((source, i) => (
                <div key={i} className="rounded-md border border-border/50 px-3 py-2">
                  <p className="text-xs font-semibold">
                    {source.title} — {source.heading}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{source.excerpt}…</p>
                  <Link
                    href={`/docs/${source.slug}`}
                    prefetch={false}
                    className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    onClick={() => setOpen(false)}
                  >
                    Read in the manual
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
