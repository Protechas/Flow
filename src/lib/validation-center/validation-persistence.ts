/**
 * Validation Center persists audit runs/findings independently of FLOW demo mode.
 * Demo mode disables Supabase for the main Flow store, but validation data should
 * still land in Supabase when credentials are configured.
 */
export function isValidationDbEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}
