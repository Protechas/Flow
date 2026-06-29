import { hydrateOperatingModelsFromSupabase } from "@/lib/data/operating-models-db";

let hydrated = false;

export async function hydrateOperatingModels(): Promise<void> {
  if (hydrated) return;
  await hydrateOperatingModelsFromSupabase();
  hydrated = true;
}

export function resetOperatingModelsHydration(): void {
  hydrated = false;
}
