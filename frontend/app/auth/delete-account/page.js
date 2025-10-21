"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function DeleteAccountPage() {
  const [token, setToken] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setToken(localStorage.getItem("psai_token"));
    }
  }, []);

  async function handleDelete(e) {
    e.preventDefault();
    if (!token) {
      setMessage("❌ Not logged in.");
      return;
    }
    if (!confirm("This will permanently delete your account. Continue?")) return;

    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${API}/auth/delete-account`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ current_password: currentPassword || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.detail || data.message || "Delete failed");

      // Clear local session
      try {
        localStorage.removeItem("psai_token");
        localStorage.removeItem("psai_status");
        localStorage.removeItem("psai_username");
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new CustomEvent("psai:auth-changed", { detail: "deleted" }));
      } catch {}

      setMessage("✅ Account deleted. Redirecting to login…");
      setTimeout(() => {
        window.location.replace("/auth/login");
      }, 1200);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 text-white space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Delete Account</h1>
        <Link
          href="/auth/profile"
          className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1 rounded-md transition-all"
        >
          ← Back to Profile
        </Link>
      </div>

      {message && (
        <div className="p-3 rounded bg-gray-800/50 border border-gray-700">{message}</div>
      )}

      <form onSubmit={handleDelete} className="space-y-4">
        <p className="text-sm opacity-90">
          Deleting your account will permanently remove your profile and your saved password stories.
        </p>

        <div>
          <label className="block mb-1 text-sm opacity-80">Current Password (recommended)</label>
          <input
            type="password"
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            placeholder="Enter current password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className="flex justify-center pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 font-semibold"
          >
            {loading ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </form>
    </div>
  );
}
