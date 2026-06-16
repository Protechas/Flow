"use client";

import { useTransition } from "react";
import { updateEmployeePayTypeAction } from "@/app/actions/users";
import { PAY_TYPES } from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PayType, User } from "@/types/flow";

export function EmployeePayTypeSelect({
  user,
  compact = false,
}: {
  user: User;
  compact?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  if (user.role !== "employee") return null;

  return (
    <Select
      value={user.pay_type ?? "hourly"}
      disabled={pending}
      onValueChange={(v) => {
        if (!v) return;
        startTransition(async () => {
          await updateEmployeePayTypeAction(user.id, v as PayType);
        });
      }}
    >
      <SelectTrigger className={compact ? "h-8 w-[110px] text-xs" : "w-[140px] h-8"}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PAY_TYPES.map((p) => (
          <SelectItem key={p.value} value={p.value}>
            {p.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
