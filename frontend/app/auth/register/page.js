"use client";

import { useState } from "react";

// same backend URL you already use
const BURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [tips, setTips] = useState(null);

  const [storyPreview, setStoryPreview] = useState(null);
  const [showStory, setShowStory] = useState(false);
  const openStory = () => setShowStory(true);
  const closeStory = () => setShowStory(false);

  const onChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  async function handleRegister(e) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${BURL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      if (!res.ok) throw new Error(data.detail || data.message || "Register failed");
      setTips(data.password_tips || null);
      setMessage("✅ Registered successfully! Redirecting to login...");

      // 🆕 wait 1.5 s then go to login
      setTimeout(() => {
        window.location.replace("/auth/login");
      }, 1500);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePreviewStory() {
    if (!form.password) {
      setStoryPreview("Enter a password first to preview a memory story.");
      openStory();
      return;
    }
    try {
      const res = await fetch(`${BURL}/story/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: form.password }),
      });
      const data = await res.json();
      setStoryPreview(data.story || "No story generated.");
      openStory();
    } catch {
      setStoryPreview("Could not generate a story right now.");
      openStory();
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Register</h1>

      {message && <div className="p-3 rounded bg-gray-800/50">{message}</div>}

      <form onSubmit={handleRegister} className="space-y-3">
        <input className="w-full p-2 rounded bg-gray-900 border border-gray-700" name="name" placeholder="Name" onChange={onChange} value={form.name} />
        <input className="w-full p-2 rounded bg-gray-900 border border-gray-700" name="email" placeholder="Email" onChange={onChange} value={form.email} />
        <input className="w-full p-2 rounded bg-gray-900 border border-gray-700" name="phone" placeholder="Phone" onChange={onChange} value={form.phone} />
        <input className="w-full p-2 rounded bg-gray-900 border border-gray-700" name="username" placeholder="Username" onChange={onChange} value={form.username} />

        <div className="space-y-1">
          <input className="w-full p-2 rounded bg-gray-900 border border-gray-700" type="password" name="password" placeholder="Password" onChange={onChange} value={form.password} />
          <button type="button" onClick={handlePreviewStory} className="text-sm underline opacity-80 hover:opacity-100">
            Do you want to remember the password?
          </button>
        </div>

        <input className="w-full p-2 rounded bg-gray-900 border border-gray-700" type="password" name="confirm_password" placeholder="Confirm Password" onChange={onChange} value={form.confirm_password} />

        <button disabled={loading} className="w-full p-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
          {loading ? "Registering..." : "Register"}
        </button>
      </form>

      {tips && (
        <div className="p-3 rounded bg-gray-800/50">
          <h3 className="font-medium mb-2">Password Tips</h3>
          <pre className="whitespace-pre-wrap text-sm opacity-90">{JSON.stringify(tips, null, 2)}</pre>
        </div>
      )}

      {showStory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
            <h3 className="text-lg font-semibold">Memory Story (preview)</h3>
            <p className="opacity-90">{storyPreview}</p>
            <div className="text-right">
              <button onClick={closeStory} className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600">
                Close
              </button>
            </div>
            <p className="text-xs opacity-70">
              We only sent abstract password hints to AI — never your real password.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
