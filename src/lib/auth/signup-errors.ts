/** User-facing signup errors (returned from server actions — not thrown). */
export function formatSignupError(message: string, code?: string | null): string {
  const lower = message.toLowerCase();
  const errorCode = code?.toLowerCase() ?? "";

  if (
    errorCode === "over_email_send_rate_limit" ||
    lower.includes("rate limit") ||
    lower.includes("email rate")
  ) {
    return "Too many signup emails were sent recently. Wait about an hour and try again, or ask your admin to invite you from Settings → Users.";
  }

  if (
    errorCode === "user_already_exists" ||
    lower.includes("already registered") ||
    lower.includes("already been registered")
  ) {
    return "An account with this email already exists. Sign in or use Forgot password.";
  }

  if (lower.includes("database error saving new user")) {
    return "We could not finish creating your account. Please contact your administrator.";
  }

  if (lower.includes("signup") && lower.includes("disabled")) {
    return "Self-service signup is disabled. Ask your admin to invite you from Settings → Users.";
  }

  if (lower.includes("redirect") || lower.includes("invalid email")) {
    return "Signup is misconfigured for this site. Please contact your administrator.";
  }

  return message.trim() || "Could not create account. Please try again.";
}
