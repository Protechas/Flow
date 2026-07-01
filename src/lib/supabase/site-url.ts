/**
 * Canonical public URL for auth redirects, invite links, and password reset emails.
 * On Vercel, ignores localhost values accidentally baked in at build time.
 */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  const isLocalhost =
    configured && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);

  if (configured && !isLocalhost) {
    return configured;
  }

  if (process.env.VERCEL) {
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (productionHost) {
      return `https://${productionHost.replace(/^https?:\/\//, "")}`;
    }
    const deployHost = process.env.VERCEL_URL?.trim();
    if (deployHost) {
      return `https://${deployHost.replace(/^https?:\/\//, "")}`;
    }
    return "https://flowproduction.space";
  }

  if (configured) return configured;

  return "http://localhost:3000";
}
