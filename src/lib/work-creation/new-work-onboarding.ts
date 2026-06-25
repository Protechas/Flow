export const NEW_WORK_ONBOARDING_VERSION = "v1";

export function newWorkOnboardingStorageKey(userId: string): string {
  return `flow.new-work-onboarding.${NEW_WORK_ONBOARDING_VERSION}.${userId}`;
}

export function isNewWorkOnboardingDismissed(
  userId: string,
  storage: Pick<Storage, "getItem"> | null = typeof localStorage !== "undefined"
    ? localStorage
    : null
): boolean {
  if (!storage) return true;
  return storage.getItem(newWorkOnboardingStorageKey(userId)) === "1";
}

export function dismissNewWorkOnboarding(
  userId: string,
  storage: Pick<Storage, "setItem"> = localStorage
): void {
  storage.setItem(newWorkOnboardingStorageKey(userId), "1");
}
