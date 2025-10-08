"use client";

import { useState } from "react";
import { API_URL } from "@/utils/api";
import { useRouter } from "next/navigation";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ new_password: "", confirm_password: "" });
  const [tips, setTips] = useState([]);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [checking, setChecking] = useState(false);

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function checkTips() {
    if (!form.new_password) return;
    setChecking(true);
    setTips([]);
    setNote("");
    setErr("");
    try {
      const res = await fetch(`${API_URL}/advisor/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.new_password }),
      });
      const data = await res.json();
      if (res.ok) {
        setTips(data.coach?.tips || []);
        setNote(data.coach?.note || "");
      } else {
        setErr(data.detail || "Failed to get tips");
      }
    } catch (e) {
      setErr("Backend not reachable");
    } finally {
      setChecking(false);
    }
  }

  async function submitChange(e) {
    e.preventDefault();
    setMsg("");
    setErr("");
    try {
      const token = localStorage.getItem("psai_token");
      if (!token) {
        router.push("/auth/login");
        return;
      }
      const res = await fetch(`${API_URL}/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_password: form.new_password,
          confirm_password: form.confirm_password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.detail || "Change password failed");
        return;
      }
      setMsg("✅ Password updated");
      // optionally redirect back to profile
      setTimeout(() => router.push("/auth/profile"), 1000);
    } catch (e) {
      setErr("Backend not reachable");
    }
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
      <h1 className="text-3xl font-bold text-yellow-300 mb-4">Change password</h1>

      <form onSubmit={submitChange} className="space-y-3">
        <input
          className="w-full p-3 rounded bg-gray-900 border border-gray-700"
          placeholder="New password"
          type="password"
          value={form.new_password}
          onChange={onChange("new_password")}
        />
        <input
          className="w-full p-3 rounded bg-gray-900 border border-gray-700"
          placeholder="Confirm new password"
          type="password"
          value={form.confirm_password}
          onChange={onChange("confirm_password")}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={checkTips}
            className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded"
          >
            {checking ? "Checking..." : "Get tips"}
          </button>
          <button
            type="submit"
            className="ml-auto bg-gradient-to-r from-yellow-600 to-orange-600 hover:opacity-90 text-white px-6 py-2 rounded-lg font-semibold"
          >
            Update
          </button>
        </div>

        {tips.length > 0 && (
          <div className="mt-2 p-3 bg-black/40 rounded border border-white/10">
            <b>Advisor tips:</b>
            <ul className="list-disc pl-5 mt-1 space-y-1">
              {tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
            {note && <p className="text-xs text-gray-300 mt-2">{note}</p>}
          </div>
        )}

        {msg && <p className="text-green-400">{msg}</p>}
        {err && <p className="text-red-400">{err}</p>}
      </form>
    </div>
  );
}
