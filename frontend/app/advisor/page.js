"use client";

import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

export default function AdvisorPage() {
  const [password, setPassword] = useState("");
  const [tips, setTips] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function getTips() {
    if (!password) return;
    setLoading(true);
    setErr("");
    setTips(null);
    try {
      const res = await fetch(`${API_URL}/advisor/tips`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok) {
        setTips(data.tips || []);
      } else {
        setErr(data.detail || "Something went wrong");
      }
    } catch (e) {
      setErr("Failed to connect to backend ❌");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10">
      <h1 className="text-3xl font-bold text-yellow-300 mb-4">
        Advisor – Improve Your Password 💡
      </h1>

      <div className="flex flex-col md:flex-row gap-3">
        <input
          type="password"
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="flex-1 p-3 rounded-lg border border-gray-700 bg-gray-100 text-black"
        />
        <button
          onClick={getTips}
          disabled={loading || !password}
          className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-3 rounded-lg font-semibold disabled:opacity-60"
        >
          {loading ? "Checking..." : "Get Tips"}
        </button>
      </div>

      {err && <p className="mt-3 text-red-400">{err}</p>}

      {tips && (
        <div className="mt-6 p-4 bg-gray-900 rounded-lg">
          <h2 className="text-xl font-bold mb-2 text-yellow-300">Suggestions</h2>
          {tips.length === 0 ? (
            <p>No tips found.</p>
          ) : (
            <ul className="list-disc pl-5 space-y-1">
              {tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
