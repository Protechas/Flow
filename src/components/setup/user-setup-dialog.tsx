"use client";

import { UserSetupWizard } from "@/components/setup/user-setup-wizard";
import {
  Dialog,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  WizardDialogBody,
  WizardDialogContent,
  WizardDialogHeader,
} from "@/components/ui/wizard-dialog";
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
      <WizardDialogContent size="lg">
        <WizardDialogHeader>
          <DialogTitle>Complete setup for {user.full_name}</DialogTitle>
        </WizardDialogHeader>
        <WizardDialogBody>
          <UserSetupWizard
            mode="update"
            initialUser={user}
            users={users}
            departments={departments}
            teams={teams}
            onComplete={() => onOpenChange(false)}
          />
        </WizardDialogBody>
      </WizardDialogContent>
    </Dialog>
  );
}
