import {
  FlowPageShell,
  WorkspaceContainer,
} from "@/components/platform";
import { PermissionManagementView } from "@/components/settings/permission-management-view";
import { requirePagePermission } from "@/lib/auth/guard";
import { listPermissionManagementDataAction } from "@/app/actions/permission-profiles";

export default async function PermissionManagementPage() {
  await requirePagePermission("users:manage");
  const data = await listPermissionManagementDataAction();

  return (
    <FlowPageShell
      title="Permission Management"
      eyebrow="Administration"
      breadcrumbs={[
        { label: "Settings", href: "/settings" },
        { label: "Permission Management" },
      ]}
      description="Control feature visibility and module permissions per user. Existing roles remain the authorization fallback."
      workspace={
        <WorkspaceContainer elevated={false}>
          <PermissionManagementView users={data.users} modules={data.modules} />
        </WorkspaceContainer>
      }
    />
  );
}
