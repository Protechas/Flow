"use client";

import { useTransition } from "react";
import { switchDemoUserAction } from "@/app/actions/auth";
import { rethrowNextNavigation } from "@/lib/navigation/rethrow-server-navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from "@/types/flow";

export function DemoRoleSwitcher({
  users,
  currentUserId,
}: {
  users: User[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Card className="border-primary/25 bg-primary/5">
      <CardHeader>
        <CardTitle className="text-base">Demo role switcher</CardTitle>
        <p className="text-xs text-muted-foreground">
          Switch user to test permissions. Navigation and actions update immediately.
        </p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {users.map((u) => (
          <Button
            key={u.id}
            type="button"
            variant={u.id === currentUserId ? "default" : "outline"}
            className={u.id === currentUserId ? "bg-primary" : ""}
            disabled={pending || u.id === currentUserId}
            onClick={() =>
              startTransition(async () => {
                try {
                  await switchDemoUserAction(u.id);
                } catch (error) {
                  rethrowNextNavigation(error);
                }
              })
            }
          >
            <span className="truncate">{u.full_name}</span>
            <span className="text-[10px] opacity-70 ml-1 capitalize">({u.role})</span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
