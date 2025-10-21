"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { validateSession, clearSession } from "@/utils/session";

export default function RequireAuth({ children }) {
  const router = useRouter();
  const pathname = usePathname();

  // 🆕 Render optimistically as soon as a token exists.
  const [ready, setReady] = useState(false);
  const redirected = useRef(false); // prevent double redirects in fast nav

  useEffect(() => {
    let mounted = true;

    // 🆕 optimistic gate: if token exists, render immediately (no waiting)
    const token = typeof window !== "undefined" ? localStorage.getItem("psai_token") : null;
    if (!token) {
      redirected.current = true;
      router.replace("/auth/login");
      setReady(false);
      return;
    }
    setReady(true); // ✅ show UI right away

    // Background verification (non-blocking)
    async function check() {
      const res = await validateSession();
      if (!mounted) return;

      if (!res.ok) {
        // invalid/expired → clear & redirect
        clearSession();
        if (!redirected.current) {
          redirected.current = true;
          router.replace("/auth/login");
        }
        return;
      }

      // valid → sync status locally (if provided)
      try {
        if (res.status) localStorage.setItem("psai_status", res.status);
      } catch {}
    }

    check();

    // Re-validate on tab auth changes & route changes,
    // but do NOT block rendering anymore.
    const onStorage = () => {
      // if someone removed the token in another tab, bail out
      const t = localStorage.getItem("psai_token");
      if (!t) {
        clearSession();
        if (!redirected.current) {
          redirected.current = true;
          router.replace("/auth/login");
        }
        return;
      }
      // otherwise just background-check
      check();
    };
    const onAuthChanged = () => check();

    window.addEventListener("storage", onStorage);
    window.addEventListener("psai:auth-changed", onAuthChanged);

    return () => {
      mounted = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("psai:auth-changed", onAuthChanged);
    };
  }, [router, pathname]);

  if (!ready && redirected.current) return null; // avoid flash after redirect
  if (!ready) return null; // initial tokenless case

  return children;
}
