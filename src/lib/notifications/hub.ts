import { categoryForType, typesForCategory } from "@/lib/notifications/categories";
import {
  countUnreadNotifications,
  listNotificationsForUser,
} from "@/lib/notifications/notifications";
import { syncOperationalNotifications } from "@/lib/notifications/producers";
import type {
  Notification,
  NotificationCategory,
  NotificationReadFilter,
  NotificationType,
} from "@/types/flow";

export interface NotificationCenterFilters {
  category?: NotificationCategory | "all";
  status?: NotificationReadFilter;
  limit?: number;
}

export interface NotificationCenterResult {
  items: Notification[];
  unread: number;
  total: number;
}

function matchesFilters(
  item: Notification,
  filters: NotificationCenterFilters
): boolean {
  const status = filters.status ?? "all";
  if (status === "unread" && item.read_status) return false;
  if (status === "read" && !item.read_status) return false;

  const category = filters.category ?? "all";
  if (category !== "all" && categoryForType(item.type) !== category) return false;

  return true;
}

export async function getNotificationCenter(
  userId: string,
  filters: NotificationCenterFilters = {}
): Promise<NotificationCenterResult> {
  const limit = filters.limit ?? 100;
  const [allItems, unread] = await Promise.all([
    listNotificationsForUser(userId, Math.max(limit, 200)),
    countUnreadNotifications(userId),
  ]);

  const items = allItems.filter((n) => matchesFilters(n, filters)).slice(0, limit);

  return {
    items,
    unread,
    total: allItems.length,
  };
}

export function syncAllNotificationSources() {
  syncOperationalNotifications();
}

export function notificationTypesForCategoryFilter(
  category: NotificationCategory | "all"
): NotificationType[] | null {
  if (category === "all") return null;
  return typesForCategory(category);
}
