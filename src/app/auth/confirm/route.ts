import { handleAuthExchange } from "@/lib/supabase/auth-redirect";

/** Handles recovery, invite, and signup links that use token_hash (and PKCE code). */
export async function GET(request: Request) {
  return handleAuthExchange(request);
}
