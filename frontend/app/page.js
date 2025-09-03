"use client";

import { useState } from "react";

export default function Home() {
  const [password, setPassword] = useState("");
  const [result, setResult] = useState(null);

  async function analyzePassword() {
    try {
      const res = await fetch("http://127.0.0.1:8000/analyze-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Error fetching backend:", err);
      setResult({ error: "Failed to connect to backend ❌" });
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white gap-6">
      <h1 className="text-3xl font-bold">Password Analyzer 🔐</h1>

      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="p-2 rounded text-black"
      />

      <button
        onClick={analyzePassword}
        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
      >
        Analyze
      </button>

      {result && !result.error && (
        <div className="mt-4 p-4 bg-gray-800 rounded w-96">
          <p><b>Password:</b> {result.password}</p>
          <p><b>Score:</b> {result.score} / 4</p>
          <p><b>Warning:</b> {result.feedback.warning || "None"}</p>
          <p><b>Suggestions:</b> {result.feedback.suggestions.join(", ") || "None"}</p>
        </div>
      )}

      {result?.error && (
        <p className="mt-4 text-red-400">{result.error}</p>
      )}
    </div>
  );
}
