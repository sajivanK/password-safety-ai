"use client";

import { clearSession } from "@/utils/session";

export default function SignOutButton({ className = "" }) {
  const handleLogout = () => {
    try {
      // 🔒 nuke local auth first (token, status, username) + broadcast to all tabs
      clearSession();
    } catch {}

    // 🚪 hard redirect so no component keeps running effects that hit /auth/me
    window.location.replace("/auth/login");
  };

  return (
    <button
      onClick={handleLogout}
      className={className || "w-full text-left px-3 py-2 rounded bg-gray-800 hover:bg-gray-700"}
    >
      Sign out
    </button>
  );
}
