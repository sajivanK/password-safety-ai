"use client";

import { useState } from "react";

// Use your existing API base env
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState(""); // username OR email
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // OAuth2 password flow expects x-www-form-urlencoded
      const body = new URLSearchParams();
      body.append("username", identifier);
      body.append("password", password);
      body.append("grant_type", "password");

      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.message || "Login failed");
      }

      // 🔑 Store under the keys your guard expects
      try {
        localStorage.setItem("psai_token", data.access_token);             // ✅ REQUIRED by RequireAuth
        localStorage.setItem("psai_status", data.status || "normal");      // optional, used by dashboard
        localStorage.setItem("psai_username", data.username || "");        // optional

        // 🔔 Let other tabs/components react immediately
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("psai:auth-changed", { detail: "logged-in" }));
      } catch {}

      setMessage("✅ Logged in successfully.");
      // Navigate after storage is done so RequireAuth can see the token
      window.location.replace("/dashboard");
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // Optional helper: show saved story for the typed identifier
  async function handleLatestStory() {
    const id = identifier.trim();
    if (!id) {
      setMessage("ℹ️ Type your username or email first.");
      return;
    }
    try {
      const qs = id.includes("@")
        ? `email=${encodeURIComponent(id)}`
        : `username=${encodeURIComponent(id)}`;
      const r = await fetch(`${API_BASE}/story/latest?${qs}`);
      const j = await r.json();
      if (j?.story) {
        alert(j.story); // simple viewer; you can swap for a nicer modal
      } else {
        alert("No saved story for this user yet.");
      }
    } catch {
      alert("Could not fetch a story right now.");
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Login</h1>

      {message && <div className="p-3 rounded bg-gray-800/50">{message}</div>}

      <form onSubmit={handleLogin} className="space-y-3">
        <input
          className="w-full p-2 rounded bg-gray-900 border border-gray-700"
          placeholder="Username or Email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
        />

        <div className="space-y-1">
          <input
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <div className="flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={handleLatestStory}
              className="underline opacity-80 hover:opacity-100"
            >
              Do you want to remember the password?
            </button>
            <a href="/auth/register" className="opacity-80 hover:opacity-100">
              Register
            </a>
          </div>
        </div>

        <button
          disabled={loading}
          className="w-full p-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
