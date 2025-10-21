// frontend/lib/api.js

// 🆕 keep naming stable with your codebase
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

/**
 * Return Authorization header if token exists.
 */
export function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("psai_token") : "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// (no breaking change here; kept minimal)
