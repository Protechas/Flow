"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "flow-ops-expanded";

type Expanded = Record<string, boolean>;

function loadExpanded(): Expanded {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Expanded) : {};
  } catch {
    return {};
  }
}

function saveExpanded(state: Expanded) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota errors */
  }
}

export function useOperationsExpanded(projectIds: string[]) {
  const [expanded, setExpanded] = useState<Expanded>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadExpanded();
    const init: Expanded = { ...stored };
    for (const id of projectIds) {
      const key = `proj-${id}`;
      if (init[key] === undefined) init[key] = true;
    }
    setExpanded(init);
    setHydrated(true);
  }, [projectIds.join(",")]);

  useEffect(() => {
    if (hydrated) saveExpanded(expanded);
  }, [expanded, hydrated]);

  const toggle = useCallback((key: string) => {
    setExpanded((e) => ({ ...e, [key]: !e[key] }));
  }, []);

  const expandAll = useCallback(() => {
    setExpanded((e) => {
      const next = { ...e };
      for (const key of Object.keys(next)) next[key] = true;
      return next;
    });
  }, []);

  const collapseAll = useCallback(() => {
    setExpanded((e) => {
      const next = { ...e };
      for (const key of Object.keys(next)) next[key] = false;
      return next;
    });
  }, []);

  return { expanded, toggle, expandAll, collapseAll, hydrated };
}
