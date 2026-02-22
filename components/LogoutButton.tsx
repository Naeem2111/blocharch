"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      type="button"
      className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
    >
      Log out
    </button>
  );
}
