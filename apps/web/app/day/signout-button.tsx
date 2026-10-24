"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <a
      href="#"
      className="muted"
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
