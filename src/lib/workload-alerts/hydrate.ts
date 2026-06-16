import {
  defaultWorkloadAlertSettings,
  mergeWorkloadAlertSettings,
  readGlobalWorkloadAlertSettings,
  readWorkloadAlertSettingsCookie,
  writeGlobalWorkloadAlertSettings,
} from "@/lib/workload-alerts/settings-persistence";
import type { WorkloadAlertSettings } from "@/types/flow";

let workloadAlertSettings: WorkloadAlertSettings =
  readGlobalWorkloadAlertSettings() ?? defaultWorkloadAlertSettings();

export function getWorkloadAlertSettings(): WorkloadAlertSettings {
  return workloadAlertSettings;
}

export function updateWorkloadAlertSettings(
  patch: Partial<
    Pick<
      WorkloadAlertSettings,
      | "enabled"
      | "work_remaining_threshold_hours"
      | "snooze_duration_hours"
      | "department_ids"
      | "team_ids"
    >
  >,
  updatedBy: string
): WorkloadAlertSettings {
  workloadAlertSettings = {
    ...workloadAlertSettings,
    ...patch,
    department_ids: patch.department_ids
      ? [...patch.department_ids]
      : workloadAlertSettings.department_ids,
    team_ids: patch.team_ids ? [...patch.team_ids] : workloadAlertSettings.team_ids,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy,
  };
  writeGlobalWorkloadAlertSettings(workloadAlertSettings);
  return workloadAlertSettings;
}

export async function hydrateWorkloadAlertSettings(): Promise<WorkloadAlertSettings> {
  const persisted = readGlobalWorkloadAlertSettings();
  if (!persisted) {
    workloadAlertSettings = defaultWorkloadAlertSettings();
    writeGlobalWorkloadAlertSettings(workloadAlertSettings);
  } else {
    workloadAlertSettings = persisted;
  }

  const cookie = await readWorkloadAlertSettingsCookie();
  if (cookie) {
    workloadAlertSettings = mergeWorkloadAlertSettings(workloadAlertSettings, cookie);
    writeGlobalWorkloadAlertSettings(workloadAlertSettings);
  }

  return workloadAlertSettings;
}
