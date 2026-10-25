import { clerkConfigured } from "@/lib/auth/bridge";
import LoginForm from "./login-form";
import ClerkLoginForm from "./clerk-login-form";

/**
 * Login (ASH-231 / 0.1a). Server component picks the form: Clerk OAuth +
 * password when configured, the pre-existing Supabase password form
 * otherwise (local dev / CI — no lockout, criterion 2). Hooks can't be
 * conditional, so the two client forms are separate components.
 */
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return clerkConfigured() ? <ClerkLoginForm /> : <LoginForm />;
}
