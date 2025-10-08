"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/utils/api";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirm_password: "",
    // status removed – backend always sets "normal"
  });

  const [tips, setTips] = useState([]);
  const [note, setNote] = useState("");
  const [loadingTips, setLoadingTips] = useState(false);

  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function getPasswordTips() {
    if (!form.password) return;
    setLoadingTips(true);
    setErr("");
    setTips([]);
    try {
      const res = await fetch(`${API_URL}/advisor/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.password }),
      });
      const data = await res.json();
      if (res.ok) {
        setTips(data.coach?.tips || []);
        setNote(data.coach?.note || "");
      } else {
        setErr(data.detail || "Failed to get tips");
      }
    } catch (e) {
      setErr("Failed to reach backend");
    } finally {
      setLoadingTips(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // ⬇️ No status sent. Backend will save status:"normal" automatically.
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          username: form.username,
          password: form.password,
          confirm_password: form.confirm_password,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg(`✅ Registered: ${data.user_id}`);
      } else {
        setErr(data.detail || "Registration failed");
      }
    } catch (e) {
      setErr("Failed to reach backend");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
      <h1 className="text-3xl font-bold text-blue-400 mb-4">Create account</h1>

      <form onSubmit={handleRegister} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <input className="p-3 rounded bg-gray-900 border border-gray-700" placeholder="Full name"
            value={form.name} onChange={onChange("name")} />
          <input className="p-3 rounded bg-gray-900 border border-gray-700" placeholder="Email"
            type="email" value={form.email} onChange={onChange("email")} />
          <input className="p-3 rounded bg-gray-900 border border-gray-700" placeholder="Phone"
            value={form.phone} onChange={onChange("phone")} />
          <input className="p-3 rounded bg-gray-900 border border-gray-700" placeholder="Username"
            value={form.username} onChange={onChange("username")} />
          <input className="p-3 rounded bg-gray-900 border border-gray-700" placeholder="Password"
            type="password" value={form.password} onChange={onChange("password")} />
          <input className="p-3 rounded bg-gray-900 border border-gray-700" placeholder="Confirm password"
            type="password" value={form.confirm_password} onChange={onChange("confirm_password")} />
        </div>

        <div className="flex items-center gap-3">
          <button type="button" onClick={getPasswordTips}
                  className="ml-auto bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded">
            {loadingTips ? "Checking..." : "Check password tips"}
          </button>
        </div>

        {tips.length > 0 && (
          <div className="mt-2 p-3 bg-black/40 rounded border border-white/10">
            <b>Advisor tips:</b>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
            {note && <p className="text-xs text-gray-300 mt-2">{note}</p>}
          </div>
        )}

        {msg && <p className="text-green-400">{msg}</p>}
        {err && <p className="text-red-400">{err}</p>}

        <button type="submit"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white px-6 py-3 rounded-lg font-semibold">
          Register
        </button>

        <p className="mt-3 text-sm text-gray-300">
          Already have an account?{" "}
          <a href="/auth/login" className="text-blue-400 hover:underline">
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}
