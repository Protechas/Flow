type ActionLogLevel = "info" | "warn" | "error";

export type ActionLogContext = {
  action: string;
  route?: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
};

function safeMetadata(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (/password|secret|token|key|authorization/i.test(key)) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

function emit(level: ActionLogLevel, message: string, ctx: ActionLogContext, error?: unknown) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    action: ctx.action,
    route: ctx.route,
    userId: ctx.userId ?? null,
    message,
    metadata: safeMetadata(ctx.metadata),
    error:
      error instanceof Error
        ? { name: error.name, message: error.message }
        : error
          ? { message: String(error) }
          : undefined,
  };

  const line = JSON.stringify(payload);
  if (level === "error") console.error("[flow-action]", line);
  else if (level === "warn") console.warn("[flow-action]", line);
  else console.info("[flow-action]", line);
}

export function logActionInfo(message: string, ctx: ActionLogContext): void {
  emit("info", message, ctx);
}

export function logActionWarn(message: string, ctx: ActionLogContext, error?: unknown): void {
  emit("warn", message, ctx, error);
}

export function logActionError(message: string, ctx: ActionLogContext, error?: unknown): void {
  emit("error", message, ctx, error);
}

/** Log failure and return a safe user-facing message. */
export function logAndFormatActionFailure(
  userMessage: string,
  ctx: ActionLogContext,
  error?: unknown
): string {
  logActionError(userMessage, ctx, error);
  return userMessage;
}
