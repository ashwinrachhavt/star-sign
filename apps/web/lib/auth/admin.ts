/**
 * Service-role Supabase client (ASH-231). Server-only module for the
 * identity bridge and the deletion cascade — operations that must
 * bypass RLS deliberately. Never import from client components.
 *
 * Fails loudly without SUPABASE_SERVICE_ROLE_KEY: silently degrading to
 * the anon key would make admin queries RLS-bound (rows invisible) with
 * no error — a far worse failure mode than a thrown one.
 */
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin (service-role) operations; refusing to fall back to the anon key.",
    );
  }
  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
