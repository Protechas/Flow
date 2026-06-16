"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Department } from "@/types/flow";

export function DepartmentFilter({
  departments,
  paramKey = "department",
  className,
}: {
  departments: Department[];
  paramKey?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get(paramKey) ?? "all";

  if (departments.length <= 1) return null;

  function onChange(value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") {
      params.delete(paramKey);
    } else {
      params.set(paramKey, value);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <Select value={current} onValueChange={onChange}>
      <SelectTrigger className={className ?? "w-[200px]"}>
        <SelectValue placeholder="All departments" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All departments</SelectItem>
        {departments.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
