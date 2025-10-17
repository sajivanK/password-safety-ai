"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    try {
      const token = localStorage.getItem("psai_token");
      if (token) {
        router.replace("/dashboard"); // logged in -> dashboard
      } else {
        router.replace("/auth/login"); // not logged -> login
      }
    } catch {
      router.replace("/auth/login");
    }
  }, [router]);

  return null; // no UI here; it just redirects
}
