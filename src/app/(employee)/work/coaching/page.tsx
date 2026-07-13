import { PageHeader } from "@/components/layout/page-header";
import { CoachingList } from "@/components/coaching/coaching-list";
import { requirePageAccess } from "@/lib/auth/guard";
import { listCoachingSessions } from "@/lib/coaching/sessions";

/** The employee's own coaching records, with acknowledgment. */
export default async function EmployeeCoachingPage() {
  const user = await requirePageAccess("/work/coaching");
  const sessions = await listCoachingSessions({ employeeId: user.id });

  return (
    <>
      <PageHeader
        title="Coaching"
        description="Your coaching conversations — review each one and acknowledge it happened"
      />
      <CoachingList sessions={sessions} viewerId={user.id} canManage={false} />
    </>
  );
}
