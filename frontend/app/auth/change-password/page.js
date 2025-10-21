"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const BURL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";

export default function ChangePasswordPage() {
  // ---------------------------
  // Form state
  // ---------------------------
  const [current, setCurrent] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Auth
  const [token, setToken] = useState(null);
  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = localStorage.getItem("psai_token");
      setToken(t);
    }
  }, []);

  // ---------------------------
  // Story modal (current/new reminders)
  // ---------------------------
  const [story, setStory] = useState(null);
  const [showStory, setShowStory] = useState(false);
  const openStory = () => setShowStory(true);
  const closeStory = () => setShowStory(false);

  // ---------------------------
  // 🧠 Live Advisor (Coach) tips while typing new password
  // ---------------------------
  const [tips, setTips] = useState([]);           // list of tips
  const [tipsNote, setTipsNote] = useState("");   // optional note
  const [tipsLoading, setTipsLoading] = useState(false);
  const [tipsError, setTipsError] = useState("");
  const [showAdvisor, setShowAdvisor] = useState(true); // collapse/expand UI

  const debounceRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    // Clear tips if no input
    if (!newPassword) {
      setTips([]);
      setTipsNote("");
      setTipsError("");
      setTipsLoading(false);
      // abort in-flight request
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    // Debounce: wait for user to stop typing for 400ms
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCoachSuggestions(newPassword);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newPassword]);

  async function fetchCoachSuggestions(passwordValue) {
    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTipsLoading(true);
    setTipsError("");
    try {
      const res = await fetch(`${BURL}/advisor/coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: passwordValue }),
        signal: controller.signal,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Advisor unavailable");
      }
      // Normalize shape: your backend usually returns { coach: { tips:[], note:"" } } or { tips, note }
      const coach = data.coach || data;
      setTips(Array.isArray(coach.tips) ? coach.tips : []);
      setTipsNote(coach.note || "");
    } catch (err) {
      if (err.name === "AbortError") return; // ignore aborted request
      setTipsError(typeof err.message === "string" ? err.message : "Failed to get tips");
      setTips([]);
      setTipsNote("");
    } finally {
      setTipsLoading(false);
    }
  }

  // ---------------------------
  // Change password flow
  // ---------------------------
  async function handleChangePassword(e) {
    e.preventDefault();
    if (!token) {
      setMessage("❌ Not logged in.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${BURL}/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: current,
          new_password: newPassword,
          confirm_password: confirm,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.message || "Change failed");

      setMessage("✅ Password updated successfully! Redirecting to your profile...");
      setCurrent("");
      setNewPassword("");
      setConfirm("");
      // Redirect to profile so the user sees updated info
      setTimeout(() => {
        window.location.replace("/auth/profile");
      }, 1200);
    } catch (err) {
      setMessage(`❌ ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------
  // Remember helpers (current + new story preview)
  // ---------------------------
  async function rememberCurrentPassword() {
    if (!token) {
      setStory("You are not logged in.");
      openStory();
      return;
    }
    try {
      const res = await fetch(`${BURL}/story/latest/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStory(data.story || "No saved story found for your account yet.");
      openStory();
    } catch {
      setStory("Could not fetch your saved story right now.");
      openStory();
    }
  }

  async function previewNewPasswordStory() {
    if (!newPassword) {
      setStory("Type your new password first to preview a memory story.");
      openStory();
      return;
    }
    try {
      const res = await fetch(`${BURL}/story/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      setStory(data.story || "No story generated.");
      openStory();
    } catch {
      setStory("Could not generate a story right now.");
      openStory();
    }
  }

  // ---------------------------
  // UI
  // ---------------------------
  return (
    <div className="max-w-2xl mx-auto p-6 text-white space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Change Password</h1>
        {/* Back to profile */}
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

      <form onSubmit={handleChangePassword} className="space-y-4">
        {/* Current password */}
        <div className="space-y-1">
          <input
            type="password"
            placeholder="Current Password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            required
          />
          <button
            type="button"
            onClick={rememberCurrentPassword}
            className="text-sm underline opacity-80 hover:opacity-100"
          >
            Need a reminder for your current password?
          </button>
        </div>

        {/* New password + Remember link + Live Advisor */}
        <div className="space-y-2">
          <input
            className="w-full p-2 rounded bg-gray-900 border border-gray-700"
            type="password"
            placeholder="New password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={previewNewPasswordStory}
              className="text-sm underline opacity-80 hover:opacity-100"
            >
              Do you want to remember the new password?
            </button>
            <button
              type="button"
              onClick={() => setShowAdvisor((s) => !s)}
              className="text-xs px-2 py-1 rounded border border-gray-600 bg-gray-800 hover:bg-gray-700"
              title="Toggle live advisor"
            >
              {showAdvisor ? "Hide Tips" : "Show Tips"}
            </button>
          </div>

          {/* 🧠 Live Advisor Panel */}
          {showAdvisor && (newPassword || tipsLoading || tipsError || tips.length > 0 || tipsNote) && (
            <div className="p-3 rounded-xl bg-gray-800/60 border border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-yellow-300">
                  Live Advisor Tips
                </h3>
                {tipsLoading && <span className="text-xs opacity-80">Analyzing…</span>}
              </div>

              {tipsError && (
                <p className="mt-2 text-sm text-red-400">{tipsError}</p>
              )}

              {!tipsError && tips.length > 0 && (
                <ul className="mt-2 list-disc pl-5 space-y-1 text-sm">
                  {tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}

              {!tipsError && tipsNote && (
                <p className="mt-2 text-xs opacity-80">{tipsNote}</p>
              )}

              {!tipsError && !tipsLoading && tips.length === 0 && !tipsNote && newPassword && (
                <p className="mt-2 text-sm opacity-80">No specific tips yet—keep typing…</p>
              )}
            </div>
          )}
        </div>

        {/* Confirm password */}
        <input
          className="w-full p-2 rounded bg-gray-900 border border-gray-700"
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />

        <div className="flex justify-center pt-2">
          <button
            disabled={loading}
            className="px-6 py-2 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 font-semibold"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </div>
      </form>

      {/* Story modal */}
      {showStory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
            <h3 className="text-lg font-semibold">Password Memory Story</h3>
            <p className="opacity-90 whitespace-pre-wrap">{story}</p>
            <div className="text-right">
              <button
                onClick={closeStory}
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600"
              >
                Close
              </button>
            </div>
            <p className="text-xs opacity-70">
              Only safe hints were used to generate this story.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
