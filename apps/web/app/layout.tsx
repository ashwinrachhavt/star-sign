import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { fontMono, fontSans, fontSerif } from "./fonts";
import "../styles/tokens.css";
import "../styles/type.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Star Sign",
  description: "A private sky shared with someone you care about.",
};

/**
 * ClerkProvider mounts only when Clerk env keys are present. Without
 * them, @clerk/nextjs v6 would run in "keyless mode" (auto-injected dev
 * keys) and hijack sessions — the fallback Supabase path must stay
 * authoritative for local dev, CI, and e2e (ASH-231 no-lockout rule).
 */
function AuthProvider({ children }: { children: React.ReactNode }) {
  const clerkOn = Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
  if (!clerkOn) return <>{children}</>;
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorBackground: "transparent",
          colorText: "#e8e6e1",
          fontFamily: "var(--font-sans), system-ui, sans-serif",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <html
        lang="en"
        className={`${fontSerif.variable} ${fontSans.variable} ${fontMono.variable}`}
      >
        <body>{children}</body>
      </html>
    </AuthProvider>
  );
}
