import { auth } from "@clerk/nextjs/server";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Route protection (ASH-231): with Clerk configured, protection keys off
 * the Clerk session; otherwise the pre-existing Supabase session path
 * applies (local stack / CI — no lockout). Supabase session refresh on
 * the fallback path is preserved.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const clerkOn = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );

  let authed = false;

  if (clerkOn) {
    try {
      const state = await auth();
      authed = Boolean(state.userId);
    } catch {
      authed = false;
    }
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key",
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value),
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options),
            );
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    authed = Boolean(user);
  }

  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login";
  const isProtected = ["/day", "/onboarding", "/people", "/week", "/verify"].some((p) =>
    pathname.startsWith(p),
  );

  if (!authed && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (authed && isAuthPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/day";
    return NextResponse.redirect(url);
  }

  return response;
}
