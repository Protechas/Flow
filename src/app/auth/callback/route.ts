import { handleAuthExchange } from "@/lib/supabase/auth-redirect";

/** OAuth and legacy PKCE callback — also accepts token_hash for compatibility. */
export async function GET(request: Request) {
  return handleAuthExchange(request);
}
