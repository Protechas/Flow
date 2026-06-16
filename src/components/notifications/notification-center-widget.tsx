import { NotificationCenterView } from "@/components/notifications/notification-center-view";
import { EnterpriseSection } from "@/components/enterprise/enterprise-section";
import type { Notification } from "@/types/flow";

export function NotificationCenterWidget({
  initialItems,
  initialUnread,
}: {
  initialItems: Notification[];
  initialUnread: number;
}) {
  return (
    <EnterpriseSection
      title="Notification Center"
      description="Operational signals across help, workload, QA, wrap-ups, and assignments"
    >
      <NotificationCenterView
        initialItems={initialItems}
        initialUnread={initialUnread}
        compact
        showViewAllLink
        pollIntervalMs={90_000}
      />
    </EnterpriseSection>
  );
}
