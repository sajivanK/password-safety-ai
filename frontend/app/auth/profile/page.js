"use client";

import { useEffect, useState } from "react";
import { API_URL } from "@/utils/api";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function loadProfile() {
    setErr("");
    try {
      const token = localStorage.getItem("psai_token");
      if (!token) {
        router.push("/auth/login");
        return;
      }
      const res = await fetch(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.detail || "Failed to load profile");
        if (res.status === 401) router.push("/auth/login");
        return;
      }
      setProfile(data.user);
    } catch (e) {
      setErr("Backend not reachable");
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function logout() {
    localStorage.removeItem("psai_token");
    localStorage.removeItem("psai_status");
    localStorage.removeItem("psai_username");
    router.push("/auth/login");
  }

  // 🆕 call backend to upgrade
  async function upgrade() {
    setMsg("");
    setErr("");
    try {
      const token = localStorage.getItem("psai_token");
      const res = await fetch(`${API_URL}/auth/upgrade-to-premium`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.detail || "Upgrade failed");
        return;
      }
      setMsg("✅ Upgraded to Premium");
      // refresh UI + localStorage
      localStorage.setItem("psai_status", "premium");
+     window.dispatchEvent(new CustomEvent("psai:plan-changed", { detail: "premium" })); // 🔔 notify others
      await loadProfile();
    } catch (e) {
      setErr("Backend not reachable");
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10 text-white">
      <h1 className="text-3xl font-bold text-green-400 mb-4">My Profile</h1>

      {err && <p className="text-red-400 mb-3">{err}</p>}
      {msg && <p className="text-green-400 mb-3">{msg}</p>}

      {!profile ? (
        <p className="opacity-80">Loading…</p>
      ) : (
        <div className="space-y-2">
          <p><b>Username:</b> {profile.username}</p>
          <p><b>Name:</b> {profile.name}</p>
          <p><b>Email:</b> {profile.email}</p>
          <p><b>Phone:</b> {profile.phone}</p>
          <p><b>Status:</b> {profile.status}</p>

          <div className="mt-6 flex flex-wrap gap-3">
            {/* Upgrade button shows only if not premium */}
            {profile.status !== "premium" && (
              <button
                onClick={upgrade}
                className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded"
              >
                Upgrade to Premium
              </button>
            )}

            <button
              onClick={() => router.push("/auth/change-password")}
              className="bg-yellow-500 hover:bg-yellow-600 text-black px-4 py-2 rounded"
            >
              Change password
            </button>
            <button
              onClick={() => router.push("/auth/edit-profile")}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
            >
              Edit profile
            </button>
            <button
              onClick={() => router.push("/auth/delete-account")}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded"
            >
              Delete account
            </button>
            <button
              onClick={logout}
              className="ml-auto bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
