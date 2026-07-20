import {
  FlowPageShell,
  WorkspaceContainer,
} from "@/components/platform";
import { MeetingNotesTool } from "@/components/tools/meeting-notes-tool";
import { requirePageAccess } from "@/lib/auth/guard";
import { getReadyFlowStore } from "@/lib/data/app-hydrate";
import { isProductionRosterMember } from "@/lib/users/production-roster";

export default async function MeetingNotesPage() {
  await requirePageAccess("/tools");

  // For the action-items approval flow: where tasks can land, and who can
  // take them. Names only — tiny payload.
  const store = await getReadyFlowStore();
  const projects = store.projects
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const assignees = store.users
    .filter((u) => u.is_active && isProductionRosterMember(u))
    .map((u) => ({ id: u.id, name: u.full_name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FlowPageShell
      title="Meeting Notes"
      eyebrow="Utilities"
      breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "Meeting Notes" }]}
      description="Paste a meeting transcript — Eddy writes the summary, pulls decisions and action items, and you approve which ones become tasks."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-6">
          <MeetingNotesTool projects={projects} assignees={assignees} />
        </WorkspaceContainer>
      }
    />
  );
}
