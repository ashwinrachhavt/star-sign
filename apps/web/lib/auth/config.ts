/**
 * Clerk configuration gate. The single place the auth strategy branches:
 * the Supabase client factory (token passthrough) and the bridge
 * (subject resolution) both key off this.
 */
export function clerkConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY,
  );
}
