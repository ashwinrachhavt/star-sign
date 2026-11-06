import { clerkMiddleware } from "@clerk/nextjs/server";
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const clerkOn = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

/**
 * Clerk must decorate the request before `updateSession` reads the
 * session: without clerkMiddleware(), Clerk's `auth()` throws
 * ("can't detect usage of clerkMiddleware") and every request looks
 * signed out, bouncing authenticated users back to /login forever.
 *
 * Without Clerk keys we keep the plain Supabase-session middleware so
 * local/CI flows are unchanged (no lockout).
 */
export default clerkOn
  ? clerkMiddleware(async (auth, request) => {
      const { userId } = await auth();
      // TEMP diagnostics: why a signed-in browser reaches an API route
      // without a session (remove once local auth is confirmed).
      if (
        process.env.NODE_ENV !== "production" &&
        request.nextUrl.pathname.startsWith("/api/")
      ) {
        const clerkCookies = request
          .cookies.getAll()
          .map((c) => c.name)
          .filter((n) => n.startsWith("__"));
        console.log(
          `[auth] ${request.nextUrl.pathname} host=${request.headers.get("host")} session=${userId ? "yes" : "no"} clerkCookies=${clerkCookies.join("|") || "none"}`,
        );
      }
      return updateSession(request, { clerkAuthed: Boolean(userId) });
    })
  : function middleware(request: NextRequest) {
      return updateSession(request);
    };

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
