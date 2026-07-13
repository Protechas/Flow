import { PageHeader } from "@/components/layout/page-header";
import { LiveRefresh } from "@/components/platform";
import { MyRequestsList } from "@/components/requests/my-requests-list";
import { RequestForm } from "@/components/requests/request-form";
import { RequestQueue } from "@/components/requests/request-queue";
import { requirePageAccess } from "@/lib/auth/guard";
import { ensureAppDataLoaded } from "@/lib/data/app-hydrate";
import { listActiveTickets, listTicketsForRequester } from "@/lib/requests/tickets";

/**
 * Requests, both directions: submit what you need from the team, and (for the
 * receiving crew) the live queue where the first person free claims it.
 */
export default async function EmployeeRequestsPage() {
  const user = await requirePageAccess("/work/requests");
  await ensureAppDataLoaded();
  const [active, mine] = await Promise.all([
    listActiveTickets(),
    listTicketsForRequester(user.id),
  ]);

  return (
    <>
      <LiveRefresh intervalMs={45_000} />
      <PageHeader
        title="Requests"
        description="Ask the team for what you need, or grab what's waiting — first claim wins"
      />
      <div className="space-y-6">
        <RequestForm />
        <div>
          <p className="flow-section-title mb-2">Team queue</p>
          <RequestQueue tickets={active} currentUserId={user.id} />
        </div>
        <div>
          <p className="flow-section-title mb-2">Your requests</p>
          <MyRequestsList tickets={mine.filter((t) => t.requested_by === user.id)} />
        </div>
      </div>
    </>
  );
}
