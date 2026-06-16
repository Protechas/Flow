import { PageHeader } from "@/components/layout/page-header";
import { NotificationCenterView } from "@/components/notifications/notification-center-view";
import { requirePageAccess } from "@/lib/auth/guard";
import { runWorkflowChecksAction } from "@/app/actions/notifications";
import { getNotificationCenter } from "@/lib/notifications/hub";

export default async function NotificationsPage() {
  const user = await requirePageAccess("/notifications");
  await runWorkflowChecksAction();
  const { items, unread } = await getNotificationCenter(user.id, { limit: 100 });

  return (
    <>
      <PageHeader
        title="Notification Center"
        eyebrow="Flow Operations"
        breadcrumbs={[{ label: "Notifications" }]}
        description="Centralized operational signals — help requests, workload, wrap-ups, QA, tasks, projects, and department health. Scoped to your role and team."
      />
      <NotificationCenterView
        initialItems={items}
        initialUnread={unread}
        pollIntervalMs={0}
      />
    </>
  );
}
