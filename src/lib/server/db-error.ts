/** Transient Supabase / network failures — safe to skip without breaking page render. */
export function isTransientDbError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : String(error ?? "");

  const normalized = message.toLowerCase();

  if (
    normalized.includes("connection timeout") ||
    normalized.includes("upstream connect error") ||
    normalized.includes("disconnect/reset before headers") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network") ||
    normalized.includes("socket hang up") ||
    normalized.includes("503") ||
    normalized.includes("502") ||
    normalized.includes("504")
  ) {
    return true;
  }

  return false;
}

export function isSchemaUnavailable(error: { code?: string; message?: string }): boolean {
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return (error.message ?? "").includes("does not exist");
}

export function shouldThrowPersistError(error: { code?: string; message?: string }): boolean {
  if (isSchemaUnavailable(error)) return false;
  if (isTransientDbError(error)) return false;
  return true;
}

export function logPersistFailure(scope: string, error: unknown): void {
  if (isTransientDbError(error)) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[${scope}] transient DB error — skipped persist:`, message);
    return;
  }
  console.error(`[${scope}]`, error);
}
