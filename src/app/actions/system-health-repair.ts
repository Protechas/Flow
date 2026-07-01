"use server";

import { writeAuditLog } from "@/lib/audit/audit-log";
import { requirePermission } from "@/lib/auth/session";
import { getFlowStore, initFlowStore, updateUser, updateWorkPackage } from "@/lib/data/flow-store";
import { ensureOrgPositionsLoaded, updateOrgPositionDb } from "@/lib/data/org-positions";
import { updateOrgPosition } from "@/lib/positions/store";
import { persistWorkPackageDb } from "@/lib/data/work-items-db";
import { updateUserProfile } from "@/lib/data/users";
import { ensureDepartmentsLoaded } from "@/lib/data/departments-db";
import { hydrateAppStore } from "@/lib/data/users";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import {
  itemsForRepairKey,
  planSystemHealthRepairs,
  type SystemHealthRepairKey,
} from "@/lib/system-health/repair-plans";
import { listActiveOrgPositions } from "@/lib/positions/store";
import { revalidatePath } from "next/cache";

export async function previewSystemHealthRepairAction(repairKey: SystemHealthRepairKey) {
  await requirePermission("settings:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();
  await hydrateAppStore();
  await ensureOrgPositionsLoaded();

  const store = getFlowStore();
  const plan = itemsForRepairKey(
    planSystemHealthRepairs({
      positions: listActiveOrgPositions(),
      packages: store.workPackages,
      users: store.users,
    }),
    repairKey
  );

  return {
    repairKey,
    count: plan.length,
    sample: plan.slice(0, 8).map((item) => ({
      entityId: item.entityId,
      label: item.label,
      field: item.field,
      previousValue: item.previousValue,
    })),
  };
}

export async function runSystemHealthRepairAction(repairKey: SystemHealthRepairKey) {
  const actor = await requirePermission("settings:manage");
  initFlowStore();
  await ensureDepartmentsLoaded();
  await hydrateAppStore();
  await ensureOrgPositionsLoaded();

  const store = getFlowStore();
  const plan = itemsForRepairKey(
    planSystemHealthRepairs({
      positions: listActiveOrgPositions(),
      packages: store.workPackages,
      users: store.users,
    }),
    repairKey
  );

  if (plan.length === 0) {
    return { ok: true as const, repaired: 0 };
  }

  let repaired = 0;

  for (const item of plan) {
    if (item.entityType === "org_position" && item.field === "reports_to_position_id") {
      if (isSupabaseConfigured()) {
        await updateOrgPositionDb(item.entityId, { reports_to_position_id: null });
      } else {
        updateOrgPosition(item.entityId, { reports_to_position_id: null });
      }
      repaired += 1;
      continue;
    }

    if (item.entityType === "work_package" && item.field === "assigned_to") {
      const updated = updateWorkPackage(item.entityId, { assigned_to: null });
      if (updated && isSupabaseConfigured()) {
        await persistWorkPackageDb(updated);
      }
      if (updated) repaired += 1;
      continue;
    }

    if (item.entityType === "user" && item.field === "manager_id") {
      if (isSupabaseConfigured()) {
        await updateUserProfile(item.entityId, { manager_id: null });
      } else {
        updateUser(item.entityId, { manager_id: null });
      }
      repaired += 1;
    }
  }

  await writeAuditLog({
    action: "workflow_alert",
    entityType: "system_health",
    entityId: repairKey,
    summary: `System health repair: ${repairKey} (${repaired} records)`,
    metadata: { repairKey, repaired, planned: plan.length },
    actorId: actor.id,
    actorEmail: actor.email,
  });

  revalidatePath("/system-health");
  revalidatePath("/org-chart");
  revalidatePath("/operations");
  revalidatePath("/settings/users");

  return { ok: true as const, repaired };
}
