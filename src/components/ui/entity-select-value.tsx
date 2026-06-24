"use client";

import { SelectValue } from "@/components/ui/select";

type Sentinel = { value: string; label: string };

type EntitySelectValueProps<T extends { id: string }> = {
  value?: string | null;
  items: T[];
  getLabel: (item: T) => string;
  placeholder?: string;
  sentinels?: Sentinel[];
};

/** Explicit select trigger label — Base UI won't resolve UUID labels when the menu is closed. */
export function EntitySelectValue<T extends { id: string }>({
  value,
  items,
  getLabel,
  placeholder = "Select…",
  sentinels = [],
}: EntitySelectValueProps<T>) {
  const sentinel = sentinels.find((s) => s.value === value);
  if (sentinel) {
    return <SelectValue placeholder={placeholder}>{sentinel.label}</SelectValue>;
  }

  if (!value || value === "__none__") {
    return <SelectValue placeholder={placeholder} />;
  }

  const match = items.find((item) => item.id === value);
  return (
    <SelectValue placeholder={placeholder}>
      {match ? getLabel(match) : placeholder}
    </SelectValue>
  );
}
