/** Secure cookies only when the public site URL uses HTTPS. */
export function useSecureCookies(): boolean {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return siteUrl.startsWith("https://");
}
