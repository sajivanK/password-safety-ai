"use client";

import { useState } from "react";
import { API_URL } from "@/utils/api";
import { useRouter } from "next/navigation";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      const token = localStorage.getItem("psai_token");
      if (!token) return router.push("/auth/login");
      const res = await fetch(`${API_URL}/auth/delete-account`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ current_password: password, confirm }),
      });
      const data = await res.json();
      if (!res.ok) return setErr(data.detail || "Delete failed");
      setMsg("✅ Account deleted");
      localStorage.clear();
      setTimeout(() => router.push("/auth/register"), 1000);
    } catch { setErr("Backend not reachable"); }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
      <h1 className="text-3xl font-bold text-red-400 mb-4">Delete account</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full p-3 rounded bg-gray-900 border border-gray-700"
               placeholder="Current password" type="password"
               value={password} onChange={(e)=>setPassword(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={confirm} onChange={(e)=>setConfirm(e.target.checked)} />
          I understand this is permanent.
        </label>
        {err && <p className="text-red-400">{err}</p>}
        {msg && <p className="text-green-400">{msg}</p>}
        <button type="submit" className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">
          Delete permanently
        </button>
      </form>
    </div>
  );
}
