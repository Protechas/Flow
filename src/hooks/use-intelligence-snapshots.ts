"use client";

import { useEffect } from "react";
import {
  recordPortfolioSnapshot,
  recordProgramSnapshot,
} from "@/lib/projects/intelligence-snapshots";
import {
  recordPortfolioSnapshotAction,
  recordProgramSnapshotAction,
} from "@/app/actions/intelligence-snapshots";
import type { PortfolioIntelligenceSummary, ProgramIntelligence } from "@/lib/projects/project-intelligence";

export function useIntelligenceSnapshots(opts: {
  portfolio?: PortfolioIntelligenceSummary;
  programs?: ProgramIntelligence[];
}) {
  const { portfolio, programs } = opts;

  useEffect(() => {
    if (portfolio) {
      recordPortfolioSnapshot(portfolio);
      void recordPortfolioSnapshotAction(portfolio);
    }
  }, [portfolio]);

  useEffect(() => {
    if (!programs?.length) return;
    for (const intel of programs) {
      recordProgramSnapshot(intel);
      void recordProgramSnapshotAction(intel);
    }
  }, [programs]);
}
