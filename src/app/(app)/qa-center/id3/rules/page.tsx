import { PageHeader } from "@/components/layout/page-header";
import { QaCenterSubnav } from "@/components/qa-center/qa-center-subnav";
import { Id3Tabs } from "@/components/qa-center/id3-tabs";
import { Id3RulesManager } from "@/components/qa-center/id3-rules-manager";
import { requirePageAccess } from "@/lib/auth/guard";
import { listId3Rules } from "@/lib/validation-center/id3-rules";

export default async function Id3RulesPage() {
  await requirePageAccess("/qa-center/id3");
  const rules = await listId3Rules();

  return (
    <>
      <PageHeader
        title="ID³ Rules"
        description="The rule set charts are validated against — editable right here, no spreadsheets required"
      />
      <QaCenterSubnav />
      <Id3Tabs />
      <Id3RulesManager rules={rules} />
    </>
  );
}
