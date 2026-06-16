import { isHTTPAccessFallbackError } from "next/dist/client/components/http-access-fallback/http-access-fallback";
import { isRedirectError } from "next/dist/client/components/redirect-error";

/** Re-throw Next.js navigation signals so redirects/notFound work from client actions. */
export function rethrowNextNavigation(error: unknown): void {
  if (isRedirectError(error) || isHTTPAccessFallbackError(error)) {
    throw error;
  }
}
