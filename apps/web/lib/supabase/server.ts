import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import { clerkConfigured } from "@/lib/auth/config";

export async function createClient() {
  const cookieStore = await cookies();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component: middleware refreshes sessions.
        }
      },
    },
    // Clerk configured: pass the Clerk session token straight through
    // (native third-party integration) so RLS v3 policies resolve the
    // actor via profiles.clerk_subject — no JWT template. Not configured:
    // keep the Supabase-session fallback exactly as before RLS v3.
    //
    // NOTE: this must not use the `accessToken` option. @supabase/ssr
    // (0.12.7, latest) unconditionally calls
    // `client.auth.onAuthStateChange`, which supabase-js throws on when
    // `accessToken` is set ("...accessing supabase.auth.onAuthStateChange
    // is not possible"). Injecting the token per request via a fetch
    // wrapper achieves the same RLS result without that conflict.
    ...(clerkConfigured()
      ? {
          global: {
            fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
              const { getToken } = await auth();
              const token = await getToken();
              const headers = new Headers(init?.headers);
              headers.set("Authorization", `Bearer ${token ?? key}`);
              return fetch(input, { ...init, headers });
            },
          },
        }
      : {}),
  });
}
