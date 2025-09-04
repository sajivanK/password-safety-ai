"use client";

import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

export default function Home() {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function analyzePassword() {
    if (!password) return;
    setLoading(true);
    setResult(null);
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-start bg-gradient-to-br from-blue-900 via-purple-900 to-gray-900 text-white px-6 py-12 rounded-3xl">
      {/* Header */}
      <div className="w-full max-w-5xl mb-8 text-center">
        <h1 className="text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Password Safety AI 🔐
        </h1>
        <p className="text-gray-400 mt-2">
          Get strength analysis, breach status, and an overall safety score in one click.
        </p>
      </div>

      {/* Input Section */}
      <div className="w-full max-w-2xl p-6 bg-gray-800/70 rounded-2xl shadow-lg backdrop-blur-sm">
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
        </div>
        {result?.error && (
          <p className="mt-3 text-red-400 font-medium">{result.error}</p>
        )}
      </div>

      {/* Results Section */}
      {result && !result.error && (
        <div className="w-full max-w-5xl grid md:grid-cols-3 gap-6 mt-8">
          {/* Strength Card */}
          <div className="p-6 bg-gray-800/70 rounded-2xl shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-blue-400">Strength</h2>
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
            <h2 className="text-xl font-bold mb-3 text-red-400">Breach</h2>
            <p>
              <b>Breached:</b> {result.breach?.breached ? "⚠️ Yes" : "✅ No"}
            </p>
            {result.breach?.breached && (
              <p><b>Times Found:</b> {result.breach.count}</p>
            )}
            <p><b>Risk Level:</b> {result.breach?.risk_level}</p>
            <p><b>Recommendation:</b> {result.breach?.recommendation}</p>
          </div>

          {/* Safety Score Card */}
          <div className="p-6 bg-gray-800/70 rounded-2xl shadow-lg">
            <h2 className="text-xl font-bold mb-3 text-green-400">Safety Score</h2>
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
    </div>
  );
}
