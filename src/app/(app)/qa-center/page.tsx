import { PageHeader } from "@/components/layout/page-header";
import { QaReviewPanel } from "@/components/qa/qa-review-panel";
import { requirePageAccess } from "@/lib/auth/guard";
import { canReviewQa } from "@/lib/auth/session";
import { getQaQueue } from "@/lib/data/qa";

export default async function QaCenterPage() {
  const user = await requirePageAccess("/qa-center");
  const queue = await getQaQueue();

  return (
    <>
      <PageHeader
        title="QA"
        description="Review queue — process submissions, track errors, and route corrections"
      />
      <QaReviewPanel queue={queue} reviewer={user} canReview={canReviewQa(user.role)} />
    </>
  );
}
