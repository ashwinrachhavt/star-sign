"use client";

import { useRouter } from "next/navigation";
import { fontMono } from "@/app/fonts";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <a
      href="#"
      className={`ui-button-link ui-focusable type-micro-label t-11 ${fontMono.className}`}
      style={{ color: "var(--ink-secondary)" }}
      onClick={async (e) => {
        e.preventDefault();
        await fetch("/auth/signout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </a>
  );
}
