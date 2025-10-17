"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/utils/api";
import { useRouter } from "next/navigation";

export default function EditProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", status: "normal" });
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const onChange = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function loadProfile() {
    setErr("");
    try {
      const token = localStorage.getItem("psai_token");
      if (!token) return router.push("/auth/login");
      const res = await fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) return setErr(data.detail || "Failed to load");
      const u = data.user || {};
      setForm({
        name: u.name || "",
        email: u.email || "",
        phone: u.phone || "",
        status: u.status || "normal",
      });
    } catch { setErr("Backend not reachable"); }
  }

  useEffect(() => { loadProfile(); /* eslint-disable-next-line */ }, []);

  async function submit(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    try {
      const token = localStorage.getItem("psai_token");
      if (!token) return router.push("/auth/login");
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) return setErr(data.detail || "Update failed");
      setMsg("✅ Profile updated");
      setTimeout(() => router.push("/auth/profile"), 800);
    } catch { setErr("Backend not reachable"); }
  }

  return (
    <div className="max-w-xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
      <h1 className="text-3xl font-bold text-blue-400 mb-4">Edit profile</h1>
      {err && <p className="text-red-400 mb-2">{err}</p>}
      <form onSubmit={submit} className="space-y-3">
        <input className="w-full p-3 rounded bg-gray-900 border border-gray-700" placeholder="Full name"
               value={form.name} onChange={onChange("name")} />
        <input className="w-full p-3 rounded bg-gray-900 border border-gray-700" placeholder="Email" type="email"
               value={form.email} onChange={onChange("email")} />
        <input className="w-full p-3 rounded bg-gray-900 border border-gray-700" placeholder="Phone"
               value={form.phone} onChange={onChange("phone")} />
        <div className="flex items-center gap-3">
          <label>Status</label>
          <select value={form.status} onChange={onChange("status")}
                  className="p-2 rounded bg-gray-900 border border-gray-700">
            <option value="normal">Normal</option>
            <option value="premium">Premium</option>
          </select>
          <button type="submit"
                  className="ml-auto bg-gradient-to-r from-blue-600 to-purple-600 hover:opacity-90 text-white px-6 py-2 rounded-lg font-semibold">
            Save
          </button>
        </div>
        {msg && <p className="text-green-400">{msg}</p>}
      </form>
    </div>
  );
}
