import {
  FlowPageShell,
  WorkspaceContainer,
} from "@/components/platform";
import { FileCheckTool } from "@/components/tools/file-check-tool";
import { requirePageAccess } from "@/lib/auth/guard";

export default async function FileCheckToolPage() {
  await requirePageAccess("/tools");

  return (
    <FlowPageShell
      title="File Name Checker"
      eyebrow="Tools"
      breadcrumbs={[{ label: "Tools", href: "/tools" }, { label: "File Name Checker" }]}
      description="See how a file list counts as effective documents before uploading — split parts collapse to one document, exact duplicates count once."
      workspace={
        <WorkspaceContainer elevated={false} bodyClassName="space-y-4">
          <FileCheckTool />
        </WorkspaceContainer>
      }
    />
  );
}
