"use client";

import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-medium">This page couldn&apos;t load</p>
      <p className="text-sm text-muted-foreground max-w-md">
        Supabase may be busy or the request timed out. Try again in a moment.
      </p>
      <div className="flex gap-2">
        <Button onClick={() => reset()}>Reload</Button>
        <Button variant="outline" onClick={() => window.history.back()}>
          Back
        </Button>
      </div>
    </div>
  );
}
