"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { validateSession, clearSession } from "@/utils/session";

export default function RequireAuth({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // ⛔ Block rendering until we verify the token with backend
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const res = await validateSession();
      if (!mounted) return;

      if (!res.ok) {
        // Invalid/expired → clear & kick to login
        clearSession();
        router.replace("/auth/login");
        setReady(false);
        return;
      }

      // Valid → ensure local status is synced
      try {
        localStorage.setItem("psai_status", res.status || "normal");
      } catch {}
      setReady(true);
    }

    check();

    // Re-validate whenever route changes (prevents sidebar showing on /auth)
    // and when other tabs log out.
    const onStorage = () => check();
    const onAuthChanged = () => check();

    window.addEventListener("storage", onStorage);
    window.addEventListener("psai:auth-changed", onAuthChanged);

    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("psai:auth-changed", onAuthChanged);
    };
  }, [router, pathname]);

  if (!ready) return null; // nothing until we know the token is valid
  return children;
}
