/** Self-service signup — off by default; set NEXT_PUBLIC_ALLOW_SELF_SIGNUP=true to enable. */
export function isSelfSignupAllowed(): boolean {
  return (
    process.env.NEXT_PUBLIC_ALLOW_SELF_SIGNUP === "true" ||
    process.env.ALLOW_SELF_SIGNUP === "true"
  );
}
