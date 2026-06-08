import { OperationsBoard } from "@/components/operations/operations-board";
import { PageHeader } from "@/components/layout/page-header";
import { requirePageAccess } from "@/lib/auth/guard";
import {
  canAssignWork,
  canDeleteProjects,
  canEditWork,
  canReviewQa,
  canSubmitToQa,
  hasPermission,
  isReadOnly,
} from "@/lib/auth/permissions";
import { getFlowStore, initFlowStore } from "@/lib/data/flow-store";
import { getAnalysts } from "@/lib/data/projects";
import { getOperationsTree } from "@/lib/data/work-packages";
import { getTeamUserIds } from "@/lib/operations/board-filters";

export default async function OperationsPage() {
  const user = await requirePageAccess("/operations");
  initFlowStore();
  const store = getFlowStore();

  const viewOwnOnly =
    hasPermission(user.role, "work:view_own") && !hasPermission(user.role, "work:view_all");

  const [tree, analysts] = await Promise.all([
    getOperationsTree(viewOwnOnly ? { assignedTo: user.id } : undefined),
    getAnalysts(),
  ]);

  const teamUserIds = viewOwnOnly ? [user.id] : getTeamUserIds(user, analysts);

  return (
    <>
      <PageHeader
        title="Operations"
        description={
          viewOwnOnly
            ? "Your assigned work — update status, log time, and submit to QA"
            : "Primary operations workspace — manage projects, manufacturers, years, and work packages"
        }
      />
      <OperationsBoard
        tree={tree}
        analysts={analysts}
        currentUserId={user.id}
        teamUserIds={teamUserIds}
        canEdit={canEditWork(user.role)}
        canAssign={canAssignWork(user.role)}
        canManageProjects={hasPermission(user.role, "projects:edit")}
        canDeleteProjects={canDeleteProjects(user.role)}
        canDeleteWork={hasPermission(user.role, "work:delete")}
        canSubmitQa={canSubmitToQa(user.role)}
        canEditQa={canReviewQa(user.role)}
        readOnly={isReadOnly(user.role)}
        comments={store.comments}
        files={store.files}
        timeLogs={store.timeLogs}
      />
    </>
  );
}
