"use client";

import { useEffect, useState } from "react";
import Link from "next/link"; // 🆕 back button

const BURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function EditProfilePage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    username: "", // 🆕 editable username
  });

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("psai_token");
      setToken(t);
      fetchProfile(t);
    }
  }, []);

  async function fetchProfile(t) {
    if (!t) return;
    try {
      const res = await fetch(`${BURL}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      const data = await res.json();
      if (data.ok && data.user) {
        const u = data.user;
        setForm({
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          username: u.username || "", // 🆕 prefill username
        });
      }
    } catch (err) {
      console.error("Profile fetch failed", err);
    }
  }

  const onChange = (e) => {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  async function handleSave(e) {
    e.preventDefault();
    if (!token) {
      setMessage("❌ Not logged in.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${BURL}/auth/edit-profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form), // includes username 🆕
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || "Update failed");

      setMessage("✅ Profile updated successfully! Redirecting…");

      // 🆕 keep a friendly pause then go to profile page
      setTimeout(() => {
        window.location.replace("/auth/profile");
      }, 1000);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 text-white space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Edit Profile</h1>
        {/* 🆕 Back button */}
        <Link
          href="/auth/profile"
          className="text-sm bg-gray-800 hover:bg-gray-700 border border-gray-600 px-3 py-1 rounded-md transition-all"
        >
          ← Back to Profile
        </Link>
      </div>

      {message && (
        <div className="p-3 rounded bg-gray-800/50 border border-gray-700 text-center">
          {message}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Full Name */}
        <div>
          <label className="block mb-1 text-sm opacity-80">Full Name</label>
          <input
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            name="name"
            placeholder="Enter full name"
            value={form.name}
            onChange={onChange}
            required
          />
        </div>

        {/* Email */}
        <div>
          <label className="block mb-1 text-sm opacity-80">Email</label>
        <input
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            name="email"
            type="email"
            placeholder="Enter email"
            value={form.email}
            onChange={onChange}
            required
          />
        </div>

        {/* Phone */}
        <div>
          <label className="block mb-1 text-sm opacity-80">Phone</label>
          <input
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            name="phone"
            placeholder="Enter phone number"
            value={form.phone}
            onChange={onChange}
          />
        </div>

        {/* 🆕 Username (unique) */}
        <div>
          <label className="block mb-1 text-sm opacity-80">Username</label>
          <input
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            name="username"
            placeholder="Choose a unique username"
            value={form.username}
            onChange={onChange}
            required
          />
          <p className="text-xs opacity-70 mt-1">
            Your username must be unique. If it’s already taken, you’ll see an error.
          </p>
        </div>

        {/* Centered Save button */}
        <div className="flex justify-center pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-semibold"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
