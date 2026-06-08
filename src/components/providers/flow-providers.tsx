"use client";

import { FlowToastProvider } from "@/components/ui/flow-toast";
import type { ReactNode } from "react";

export function FlowProviders({ children }: { children: ReactNode }) {
  return <FlowToastProvider>{children}</FlowToastProvider>;
}
