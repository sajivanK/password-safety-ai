"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";
import { API_URL } from "@/utils/api";

export default function UpgradeBillingPage() {
  const router = useRouter();
  const search = useSearchParams();

  // 🆕 read `from` so we can show a message & return users to where they came from
  const from = useMemo(() => search.get("from") || "", [search]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function upgradeNow() {
    setErr("");
    setMsg("");
    setLoading(true);
    try {
      // pretend payment succeeds instantly; call backend to flip status
      const token = localStorage.getItem("psai_token");
      const res = await fetch(`${API_URL}/auth/upgrade-to-premium`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.detail || "Upgrade failed");
        setLoading(false);
        return;
      }

      // update local plan + notify app (Sidebar listens to this)
      localStorage.setItem("psai_status", "premium");
      window.dispatchEvent(new CustomEvent("psai:plan-changed", { detail: "premium" }));
      setMsg("✅ Payment successful — you’re now Premium!");

      // 🆕 if we have a `from` page (e.g., 'breach'), go back there; else profile
      const target =
        from === "breach" ? "/breach" :
        from === "generator" ? "/generator" :
        from === "chat" ? "/chat" :
        "/auth/profile";

      setTimeout(() => router.replace(target), 700);
    } catch (e) {
      setErr("Backend not reachable");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <div className="max-w-xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
        <h1 className="text-3xl font-bold text-yellow-300 mb-4">Go Premium</h1>

        {/* 🆕 gentle context banner if user was redirected from a premium-only page */}
        {from && (
          <div className="mb-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-200 text-sm">
            This feature requires a Premium plan.
            {from === "breach" && " The Breach Checker is Premium."}
            {from === "generator" && " Multilingual passwords are Premium."}
            {from === "chat" && " The breach lookup in Chat is Premium."}
          </div>
        )}

        <p className="opacity-80 mb-4">
          Unlock breach checks, multilingual passwords, and future premium features.
        </p>

        {err && <p className="text-red-400 mb-2">{err}</p>}
        {msg && <p className="text-green-400 mb-2">{msg}</p>}

        <button
          onClick={upgradeNow}
          disabled={loading}
          className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:opacity-90 text-black px-6 py-3 rounded-lg font-semibold disabled:opacity-50"
        >
          {loading ? "Processing…" : "Upgrade to Premium"}
        </button>

        <button
          onClick={() => router.back()}
          className="ml-3 px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-white"
        >
          Cancel
        </button>
      </div>
    </RequireAuth>
  );
}
