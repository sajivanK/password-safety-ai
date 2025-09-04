"use client";

import { useState } from "react";

const API_URL = "http://127.0.0.1:8000";

// 🚨 In real app, this should come from user profile
const isPremiumUser = true; // change to true to unlock multilingual

export default function GeneratorPage() {
  const [options, setOptions] = useState({
    length: 12,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    mode: "deterministic", // deterministic | llm | multilingual
    language: "", // only used in multilingual mode
  });
  const [result, setResult] = useState(null);

  async function generatePassword() {
    try {
      const res = await fetch(`${API_URL}/generator/create-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error("Error:", err);
      setResult({ error: "Failed to generate password ❌" });
    }
  }

  function copyToClipboard() {
    if (result?.password) {
      navigator.clipboard.writeText(result.password);
      alert("Password copied to clipboard ✅");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10">
      <h1 className="text-3xl font-bold text-purple-400 mb-6">
        Password Generator ⚡
      </h1>

      {/* Length slider */}
      <div className="mb-6">
        <label className="block mb-2">Length: {options.length}</label>
        <input
          type="range"
          min="8"
          max="32"
          value={options.length}
          onChange={(e) =>
            setOptions({ ...options, length: parseInt(e.target.value) })
          }
          className="w-full accent-purple-500"
        />
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {["uppercase", "lowercase", "numbers", "symbols"].map((opt) => (
          <label key={opt} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={options[opt]}
              onChange={(e) =>
                setOptions({ ...options, [opt]: e.target.checked })
              }
            />
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </label>
        ))}
      </div>

      {/* Mode selector */}
      <div className="mb-6">
        <label className="block mb-2">Mode</label>
        <select
          value={options.mode}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "multilingual" && !isPremiumUser) {
              alert("🚀 Upgrade to Premium to unlock Multilingual Passwords!");
              return;
            }
            setOptions({ ...options, mode: value });
          }}
          className="p-2 rounded bg-gray-900 text-white border border-gray-700"
        >
          <option value="deterministic">Deterministic (Default)</option>
          <option value="llm">LLM (Gemini Passphrase)</option>
          <option value="multilingual">
            Multilingual (Premium 🔒)
          </option>
        </select>
      </div>

      {/* Language selector (only if multilingual + premium) */}
      {options.mode === "multilingual" && isPremiumUser && (
        <div className="mb-6">
          <label className="block mb-2">Choose Language</label>
          <select
            value={options.language}
            onChange={(e) =>
              setOptions({ ...options, language: e.target.value })
            }
            className="p-2 rounded bg-gray-900 text-white border border-gray-700"
          >
            <option value="">-- Select a Language --</option>
            <option value="ta">Tamil</option>
            <option value="si">Sinhala</option>
            <option value="hi">Hindi</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="zh">Chinese</option>
            <option value="ar">Arabic</option>
          </select>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={generatePassword}
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md"
      >
        Generate
      </button>

      {/* Result */}
      {result && (
        <div className="mt-6 p-4 bg-gray-900 rounded-lg shadow">
          {result.error ? (
            <p className="text-red-400">{result.error}</p>
          ) : (
            <>
              <p className="text-lg font-mono break-all">{result.password}</p>
              <p className="text-sm text-gray-400">Length: {result.length}</p>
              <p className="text-sm text-gray-400">Mode: {result.mode}</p>
              {result.language && (
                <p className="text-sm text-gray-400">
                  Language: {result.language}
                </p>
              )}
              <button
                onClick={copyToClipboard}
                className="mt-3 bg-blue-600 hover:bg-blue-700 px-4 py-1 rounded text-sm"
              >
                Copy
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
