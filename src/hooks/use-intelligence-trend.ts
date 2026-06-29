"use client";

import { useEffect, useState } from "react";
import {
  getPortfolioTrend,
  getProgramTrend,
  type PortfolioTrendPoint,
  type ProgramTrendPoint,
} from "@/lib/projects/intelligence-snapshots";

/** Load portfolio trend after mount so SSR and first client paint match (no localStorage on server). */
export function usePortfolioTrend(days = 14, refreshKey?: string | number): PortfolioTrendPoint[] {
  const [trend, setTrend] = useState<PortfolioTrendPoint[]>([]);

  useEffect(() => {
    setTrend(getPortfolioTrend(days));
  }, [days, refreshKey]);

  return trend;
}

/** Load program trend after mount so SSR and first client paint match. */
export function useProgramTrend(
  projectId: string,
  days = 14,
  refreshKey?: string | number
): ProgramTrendPoint[] {
  const [trend, setTrend] = useState<ProgramTrendPoint[]>([]);

  useEffect(() => {
    setTrend(getProgramTrend(projectId, days));
  }, [projectId, days, refreshKey]);

  return trend;
}
