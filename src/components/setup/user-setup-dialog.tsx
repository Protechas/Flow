"use client";

import { UserSetupWizard } from "@/components/setup/user-setup-wizard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Department, Team, User } from "@/types/flow";

export function UserSetupDialog({
  open,
  onOpenChange,
  user,
  users,
  departments,
  teams,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User;
  users: User[];
  departments: Department[];
  teams: Team[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete setup for {user.full_name}</DialogTitle>
        </DialogHeader>
        <UserSetupWizard
          mode="update"
          initialUser={user}
          users={users}
          departments={departments}
          teams={teams}
          onComplete={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
