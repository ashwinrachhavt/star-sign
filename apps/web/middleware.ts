import { clerkMiddleware } from "@clerk/nextjs/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * clerkMiddleware must own the middleware chain: Clerk's server-side
 * auth()/currentUser() inside route handlers only resolve when the
 * request passed through clerkMiddleware(). Without it, every API route
 * 500s under a live Clerk instance ("auth() was called but Clerk can't
 * detect usage of clerkMiddleware()") — CI never saw this because the
 * E2E smoke runs with stubbed sessions and no live Clerk keys. The
 * Supabase session-refresh + route-protection logic is preserved
 * verbatim inside the handler.
 */
export default clerkMiddleware(async (auth, request) => {
  // Pass the verified state through so `updateSession` does not re-read
  // the session (and cannot disagree with what clerkMiddleware resolved).
  const { userId } = await auth();
  return updateSession(request, { clerkAuthed: Boolean(userId) });
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
