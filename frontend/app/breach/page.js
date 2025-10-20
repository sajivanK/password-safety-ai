"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";

export default function BreachPage() {
  const router = useRouter();
  const [plan, setPlan] = useState("normal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const stored = localStorage.getItem("psai_status");
      const p = stored === "premium" ? "premium" : "normal";
      setPlan(p);
      if (p !== "premium") {
        // 👇 redirect normal users to billing page
        router.replace("/plans?from=breach");
      }
    } catch {
      router.replace("/plans?from=breach");
    }
  }, [router]);

  // avoid flashing content while checking
  if (!mounted || plan !== "premium") return null;

  return (
    <RequireAuth>
      <div className="max-w-2xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
        <h1 className="text-3xl font-bold text-yellow-300 mb-4">Breach Check (Premium)</h1>
        <p className="opacity-80">
          You’re Premium 🎉 — drop your password or hash here (UI coming next step).
        </p>
        {/* TODO: add the actual breach-check UI next */}
      </div>
    </RequireAuth>
  );
}
