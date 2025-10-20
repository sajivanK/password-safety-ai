"use client";

import { useEffect, useState } from "react";
import RequireAuth from "@/components/RequireAuth";
import { API_BASE, authHeaders } from "@/lib/api";
import { encryptSecret, decryptSecret } from "@/lib/vaultCrypto";

export default function VaultPage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add form
  const [label, setLabel] = useState("");
  const [login, setLogin] = useState("");
  const [url, setUrl] = useState("");
  const [password, setPassword] = useState("");

  // Premium status
  const [userPlan, setUserPlan] = useState("normal");

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editLabel, setEditLabel] = useState("");
  const [editLogin, setEditLogin] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editPassword, setEditPassword] = useState("");

  // --- Load vault entries ---
  async function load() {
    setLoading(true);
    const r = await fetch(`${API_BASE}/api/vault/`, { headers: { ...authHeaders() } });
    const d = await r.json();
    setEntries(d.entries || []);
    setLoading(false);
  }

  useEffect(() => {
    // Detect plan from localStorage
    try {
      const plan = localStorage.getItem("psai_status");
      setUserPlan(plan === "premium" ? "premium" : "normal");
    } catch {
      setUserPlan("normal");
    }
    load();
  }, []);

  // --- Add new entry ---
  async function onAdd(e) {
    e.preventDefault();

    // 🧩 Premium check
    if (userPlan !== "premium" && entries.length >= 5) {
      alert("⚠️ Free users can only store 5 passwords. Please upgrade to Premium.");
      window.location.href = "/plans?from=vault"; // redirect to upgrade
      return;
    }

    const token = localStorage.getItem("psai_token");
    if (!token) return alert("Please log in first.");

    let passphrase = sessionStorage.getItem("vault_passphrase");
    if (!passphrase) {
      passphrase = prompt("Vault passphrase (remember this!)") || "";
      if (!passphrase) return;
      sessionStorage.setItem("vault_passphrase", passphrase);
    }

    const { salt, iv, ciphertext } = await encryptSecret(password, passphrase);

    const res = await fetch(`${API_BASE}/api/vault/`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ label, login, url, salt, iv, ciphertext }),
    });

    if (!res.ok) {
      const t = await res.text();
      return alert(`Save failed: ${res.status} ${t}`);
    }

    setLabel(""); setLogin(""); setUrl(""); setPassword("");
    await load();
    alert("Saved to Vault ✅");
  }

  async function onCopy(e) {
    let passphrase = sessionStorage.getItem("vault_passphrase") || prompt("Vault passphrase:") || "";
    if (!passphrase) return;
    try {
      const pwd = await decryptSecret(e.ciphertext, passphrase, e.salt, e.iv);
      await navigator.clipboard.writeText(pwd);
      alert("Copied ✅");
    } catch {
      alert("Decryption failed (wrong passphrase?)");
    }
  }

  async function onDelete(id) {
    if (!confirm("Delete this entry?")) return;
    const r = await fetch(`${API_BASE}/api/vault/${id}`, { method: "DELETE", headers: { ...authHeaders() } });
    if (r.ok) setEntries(prev => prev.filter(x => x.id !== id));
    else alert("Delete failed");
  }

  function startEdit(e) {
    setEditingId(e.id);
    setEditLabel(e.label || "");
    setEditLogin(e.login || "");
    setEditUrl(e.url || "");
    setEditPassword("");
  }

  async function saveEdit() {
    const body = { label: editLabel, login: editLogin, url: editUrl };

    if (editPassword.trim()) {
      let passphrase = sessionStorage.getItem("vault_passphrase") || prompt("Vault passphrase:") || "";
      if (!passphrase) return;
      const { salt, iv, ciphertext } = await encryptSecret(editPassword, passphrase);
      body.salt = salt;
      body.iv = iv;
      body.ciphertext = ciphertext;
    }

    const res = await fetch(`${API_BASE}/api/vault/${editingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body),
    });
    if (!res.ok) return alert("Update failed");

    setEditingId(null);
    setEditPassword("");
    await load();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPassword("");
  }

  // --- UI ---
  return (
    <RequireAuth>
      <div className="max-w-2xl mx-auto p-6 bg-gray-800/70 rounded-2xl shadow-lg mt-10">
        <h1 className="text-3xl font-bold text-purple-400 mb-2">Password Manager 🔐</h1>
        <p className="text-sm text-gray-400 mb-4">
          {userPlan === "premium" ? "✅ Premium user — unlimited storage" : "Free plan — 5 entries max"}
        </p>

        {/* Add Form */}
        <form onSubmit={onAdd} className="space-y-4">
          <div>
            <label className="block mb-2">Label</label>
            <input
              className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white border border-gray-700"
              placeholder="Facebook, Coursera…"
              value={label}
              onChange={e => setLabel(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block mb-2">Login (email/username)</label>
              <input
                className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white border border-gray-700"
                placeholder="you@example.com / handle"
                value={login}
                onChange={e => setLogin(e.target.value)}
              />
            </div>
            <div>
              <label className="block mb-2">URL (optional)</label>
              <input
                className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white border border-gray-700"
                placeholder="https://www.facebook.com"
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block mb-2">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 rounded-lg bg-gray-900 text-white border border-gray-700"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg font-semibold shadow-md">
            Add to Vault
          </button>
        </form>

        {/* Entries */}
        <div className="mt-8">
          <h2 className="text-xl font-medium mb-3">My Entries</h2>
          {loading && <div className="text-gray-400">Loading…</div>}
          {!loading && entries.length === 0 && (
            <div className="text-gray-400">No entries yet.</div>
          )}

          <div className="space-y-3">
            {entries.map(e => (
              <div key={e.id} className="p-4 bg-gray-900 rounded-lg shadow">
                {editingId === e.id ? (
                  // Edit mode
                  <div className="space-y-3">
                    {/* ... your edit fields unchanged ... */}
                  </div>
                ) : (
                  // Read mode
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {e.faviconUrl && (
                        <img
                          src={e.faviconUrl}
                          alt=""
                          width={24}
                          height={24}
                          className="rounded-md"
                        />
                      )}
                      <div className="font-medium text-white">{e.label}</div>
                      <div className="text-sm text-gray-400">
                        {e.login || ""}{e.url ? ` · ${e.url}` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-4 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm"
                        onClick={() => onCopy(e)}
                      >
                        Copy
                      </button>
                      <button
                        className="px-4 py-1 rounded bg-yellow-600 hover:bg-yellow-700 text-white text-sm"
                        onClick={() => startEdit(e)}
                      >
                        Edit
                      </button>
                      <button
                        className="px-4 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-sm"
                        onClick={() => onDelete(e.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {userPlan !== "premium" && (
          <p className="text-xs text-yellow-300 mt-4">
            You are on <b>Normal</b> plan. To unlock unlimited vault storage,{" "}
            <a href="/plans?from=vault" className="underline">upgrade to Premium</a>.
          </p>
        )}
      </div>
    </RequireAuth>
  );
}
