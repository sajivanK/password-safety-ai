"use client";

import RequireAuth from "@/components/RequireAuth";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API_URL } from "@/utils/api"; // 🟡 NEW: use your API base

export default function DashboardPage() {
  // plan badge (existing behavior)
  const [plan, setPlan] = useState("normal");
  useEffect(() => {
    try {
      const stored = localStorage.getItem("psai_status");
      setPlan(stored === "premium" ? "premium" : "normal");
    } catch {
      setPlan("normal");
    }
  }, []);

  // Password Quick Check (as before)
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // 🟡 NEW: Advisor tips state now supports note (coach_agent returns tips + note)
  const [tips, setTips] = useState(null);
  const [tipsNote, setTipsNote] = useState("");  // 🟡 NEW
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");

  // Analyze (unchanged)
  async function analyzePassword() {
    if (!password) return;
    setLoading(true);
    setResult(null);
    // reset tips panel when re-analyzing
    setTips(null);
    setTipsNote("");       // 🟡 NEW
    setTipsError("");

    try {
      const res = await fetch(`${API_URL}/report/analyze-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Error fetching backend:", err);
      setResult({ error: "Failed to connect to backend ❌" });
    } finally {
      setLoading(false);
    }
  }

  // 🟡 NEW: Get Advisor tips from the NEW endpoint: /advisor/coach
  async function getAdvisorTips() {
    if (!password) return;
    setTipsLoading(true);
    setTipsError("");
    setTips(null);
    setTipsNote(""); // 🟡 NEW

    try {
      const res = await fetch(`${API_URL}/advisor/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (res.ok) {
        // Coach API commonly returns: { coach: { tips: [...], note: "..." } }
        const coach = data.coach || data; // be tolerant to shape
        const list = coach.tips || data.tips || [];
        const note = coach.note || data.note || "";
        setTips(list);
        setTipsNote(note); // 🟡 NEW
      } else {
        setTipsError(data.detail || "Something went wrong");
      }
    } catch (e) {
      setTipsError("Failed to connect to backend ❌");
    } finally {
      setTipsLoading(false);
    }
  }

  return (
    <RequireAuth>
      <main className="flex-1 p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
        <p className="opacity-80">
          Welcome! Use the sidebar to navigate. Your access level is{" "}
          <b>{plan.toUpperCase()}</b>.
        </p>

        {plan !== "premium" && (
          <div className="mt-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
            <p className="text-yellow-300">
              Unlock breach checks and multilingual passwords with Premium.
            </p>
            <Link
              href="/billing/upgrade"
              className="inline-block mt-3 bg-gradient-to-r from-yellow-500 to-orange-600 text-black px-4 py-2 rounded-lg font-semibold hover:opacity-90"
            >
              Upgrade to Premium
            </Link>
          </div>
        )}

        {/* Password Quick Check panel */}
        <section className="mt-8">
          <div className="w-full max-w-3xl p-6 bg-gray-800/70 rounded-2xl shadow-lg backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-4 text-blue-300">
              Password Quick Check 🔐
            </h2>

            <div className="flex flex-col md:flex-row items-stretch gap-4">
              <input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="flex-1 p-3 rounded-lg border border-gray-700 bg-gray-100 text-black focus:ring-2 focus:ring-blue-500"
              />

              <button
                onClick={analyzePassword}
                disabled={loading || !password}
                className="bg-gradient-to-r from-blue-600 to-purple-600 disabled:opacity-60 disabled:cursor-not-allowed hover:from-blue-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-semibold shadow-md transition-all"
              >
                {loading ? "Analyzing..." : "Analyze"}
              </button>

              <button
                onClick={getAdvisorTips}
                disabled={tipsLoading || !password}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-lg font-semibold disabled:opacity-60"
              >
                {tipsLoading ? "Getting tips..." : "Get Tips"}
              </button>
            </div>

            {/* Errors */}
            {result?.error && (
              <p className="mt-3 text-red-400 font-medium">{result.error}</p>
            )}
            {tipsError && (
              <p className="mt-3 text-red-400 font-medium">{tipsError}</p>
            )}
          </div>

          {/* Results */}
          {result && !result.error && (
            <div className="w-full max-w-5xl grid md:grid-cols-3 gap-6 mt-8">
              {/* Strength Card */}
              <div className="p-6 bg-gray-800/70 rounded-2xl shadow-lg">
                <h3 className="text-lg font-bold mb-3 text-blue-400">Strength</h3>
                <p><b>Score:</b> {result.strength?.score} / 4</p>
                <p><b>Warning:</b> {result.strength?.feedback?.warning || "None"}</p>
                <p>
                  <b>Suggestions:</b>{" "}
                  {result.strength?.feedback?.suggestions?.length > 0
                    ? result.strength.feedback.suggestions.join(", ")
                    : "None"}
                </p>
              </div>

              {/* Breach Card */}
              <div className="p-6 bg-gray-800/70 rounded-2xl shadow-lg">
                <h3 className="text-lg font-bold mb-3 text-red-400">Breach</h3>
                <p>
                  <b>Breached:</b>{" "}
                  {result.breach?.breached ? "⚠️ Yes" : "✅ No"}
                </p>
                {result.breach?.breached && (
                  <p><b>Times Found:</b> {result.breach.count}</p>
                )}
                <p><b>Risk Level:</b> {result.breach?.risk_level}</p>
                <p><b>Recommendation:</b> {result.breach?.recommendation}</p>
              </div>

              {/* Safety Score Card */}
              <div className="p-6 bg-gray-800/70 rounded-2xl shadow-lg">
                <h3 className="text-lg font-bold mb-3 text-green-400">Safety Score</h3>
                <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div
                    className="h-4 bg-gradient-to-r from-green-400 to-green-600 transition-all"
                    style={{ width: `${result.safety_score ?? 0}%` }}
                  />
                </div>
                <p className="mt-2 font-semibold">{result.safety_score ?? 0} / 100</p>
              </div>
            </div>
          )}

          {/* Advisor Tips (from new coach endpoint) */}
          {tips && (
            <div className="w-full max-w-5xl mt-8">
              <div className="p-6 bg-gray-800/70 rounded-2xl shadow-lg">
                <h3 className="text-lg font-bold mb-3 text-yellow-300">
                  Advisor Tips 💡
                </h3>
                {tips.length === 0 ? (
                  <p>No tips found.</p>
                ) : (
                  <ul className="list-disc pl-5 space-y-1">
                    {tips.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                )}

                {/* 🟡 NEW: optional footnote/note from coach */}
                {tipsNote && (
                  <p className="text-xs text-gray-300 mt-3">{tipsNote}</p>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </RequireAuth>
  );
}
