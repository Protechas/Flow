"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitRequestTicketAction } from "@/app/actions/request-tickets";
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
import { useFlowToast } from "@/components/ui/flow-toast";
import type { RequestTicketPriority } from "@/types/flow";
import { Loader2, Send } from "lucide-react";

/** The whole point: "I need a doc for X" in ten seconds, no Teams message. */
export function RequestForm() {
  const router = useRouter();
  const { toast } = useFlowToast();
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<RequestTicketPriority>("normal");
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!title.trim()) return;
    startTransition(async () => {
      const res = await submitRequestTicketAction({
        title,
        details,
        priority,
      });
      if (!res.ok) {
        toast({ variant: "error", title: "Could not submit", description: res.message });
        return;
      }
      toast({
        variant: "success",
        title: "Request submitted",
        description: "The team can see it now — you'll get a notification when someone grabs it.",
      });
      setTitle("");
      setDetails("");
      setPriority("normal");
      router.refresh();
    });
  };

  return (
    <div className="enterprise-panel p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Need something from the team?</p>
        <p className="text-xs text-muted-foreground">
          Submit it here — it shows up on the whole team&apos;s screens and the first person free
          grabs it.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="request-title">What do you need?</Label>
        <Input
          id="request-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Doc for the 2026 Toyota RAV4 ADAS bulletin"
          maxLength={200}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
        <div className="space-y-1.5">
          <Label htmlFor="request-details">Details (optional)</Label>
          <Textarea
            id="request-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Anything the person grabbing this needs to know"
            rows={2}
            maxLength={2000}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="request-priority">Priority</Label>
          <Select value={priority} onValueChange={(v) => v && setPriority(v as RequestTicketPriority)}>
            <SelectTrigger id="request-priority" className="w-full bg-card text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low — whenever</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="button" onClick={submit} disabled={pending || !title.trim()}>
        {pending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Send className="mr-1.5 h-4 w-4" />
        )}
        Submit request
      </Button>
    </div>
  );
}
