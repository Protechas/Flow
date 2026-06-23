import { DocsIndexView } from "@/components/docs/docs-index-view";
import { requirePageAccess } from "@/lib/auth/guard";

export default async function DocsPage() {
  const user = await requirePageAccess("/docs");
  return <DocsIndexView user={user} />;
}
