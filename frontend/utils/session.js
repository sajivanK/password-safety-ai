// 🔒 utils/session.js
import { API_URL } from "@/utils/api";

/**
 * Ping backend to validate token.
 * Returns { ok: true, user, status } if valid, else { ok: false }.
 * Backend endpoint is /auth/me (returns { ok: True, user: {...} } in your API).
 */
export async function validateSession() {
  try {
    const token = localStorage.getItem("psai_token");
    if (!token) return { ok: false };

    const res = await fetch(`${API_URL}/auth/me`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      return { ok: false };
    }

    const data = await res.json();
    // 🆕 map your backend shape -> friendly return
    // your /auth/me returns: { ok: True, user: { ..., status } }
    const user = data.user || data; // fallback just in case
    const statusFromApi =
      (user && (user.status || user?.user?.status)) ||
      data.status ||
      null;

    const status = statusFromApi || localStorage.getItem("psai_status") || "normal";
    return { ok: true, user, status };
  } catch {
    return { ok: false };
  }
}

/**
 * Force logout locally (no network).
 */
export function clearSession() {
  try {
    localStorage.removeItem("psai_token");
    localStorage.removeItem("psai_status");
    localStorage.removeItem("psai_username");
    // Broadcast so Sidebar / other tabs react immediately
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("psai:auth-changed", { detail: "logged-out" }));
  } catch {}
}
