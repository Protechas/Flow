import { getSiteUrl } from "@/lib/supabase/site-url";

/** Secure cookies only when the public site URL uses HTTPS. */
export function shouldUseSecureCookies(): boolean {
  return getSiteUrl().startsWith("https://");
}
