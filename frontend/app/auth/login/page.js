"use client";

import { useState, useEffect } from "react"; // ⬅️ added useEffect
import { API_URL } from "@/utils/api";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  // ⬇️ render only after client mounts to avoid SSR/extension hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setMsg("");

    try {
      const body = new URLSearchParams();
      body.append("username", form.username);
      body.append("password", form.password);

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      const data = await res.json();
      if (!res.ok) {
        setErr(data.detail || "Login failed");
        return;
      }

      // Save token + basic info
      localStorage.setItem("psai_token", data.access_token);
      localStorage.setItem("psai_status", data.status || "normal");
      localStorage.setItem("psai_username", data.username || "");

      setMsg("✅ Logged in");
      router.push("/dashboard");
    } catch (e) {
      setErr("Failed to reach backend");
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
      <h1 className="text-3xl font-bold text-purple-400 mb-4">Login</h1>

      <form onSubmit={handleLogin} className="space-y-3">
        <input
          className="w-full p-3 rounded bg-gray-900 border border-gray-700"
          placeholder="Username"
          value={form.username}
          onChange={onChange("username")}
          autoComplete="username"        // ⬅️ hint for password managers
        />
        <input
          className="w-full p-3 rounded bg-gray-900 border border-gray-700"
          placeholder="Password"
          type="password"
          value={form.password}
          onChange={onChange("password")}
          autoComplete="current-password" // ⬅️ hint for password managers
        />

        {msg && <p className="text-green-400">{msg}</p>}
        {err && <p className="text-red-400">{err}</p>}

        <button
          type="submit"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold"
        >
          Sign in
        </button>

        <p className="mt-3 text-sm text-gray-300">
          Don’t have an account?{" "}
          <a href="/auth/register" className="text-blue-400 hover:underline">
            Register a new user
          </a>
        </p>
      </form>
    </div>
  );
}
