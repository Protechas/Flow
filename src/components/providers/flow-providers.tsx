"use client";

import { FlowToastProvider } from "@/components/ui/flow-toast";
import { ThemeProvider } from "@/components/providers/theme-provider";
import type { ReactNode } from "react";

export function FlowProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <FlowToastProvider>{children}</FlowToastProvider>
    </ThemeProvider>
  );
}
