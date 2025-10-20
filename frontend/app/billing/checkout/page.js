"use client";

import { useState, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import RequireAuth from "@/components/RequireAuth";

const API_URL = "http://127.0.0.1:8000";

// Small helper to validate basic payment fields
function validateInputs(card, expiry, cvc, name, email) {
  if (!name.trim()) return "Please enter your cardholder name.";
  if (!email.match(/^\S+@\S+\.\S+$/)) return "Enter a valid email.";
  if (!/^\d{16}$/.test(card.replace(/\s/g, ""))) return "Card number must be 16 digits.";
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return "Expiry format must be MM/YY.";
  if (!/^\d{3}$/.test(cvc)) return "CVC must be 3 digits.";
  return "";
}

export default function CheckoutPage() {
  const router = useRouter();
  const search = useSearchParams();
  const from = useMemo(() => search.get("from") || "generator", [search]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [card, setCard] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvc, setCvc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handlePayment(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const validation = validateInputs(card, expiry, cvc, name, email);
    if (validation) return setError(validation);

    setLoading(true);
    try {
      // Simulate payment delay (fake processing)
      await new Promise((r) => setTimeout(r, 1200));

      const token = localStorage.getItem("psai_token");
      if (!token) throw new Error("Please login first.");

      // Call backend to mark user as premium
      const res = await fetch(`${API_URL}/auth/upgrade-to-premium`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Upgrade failed.");

      // Update local status
      localStorage.setItem("psai_status", "premium");

      setSuccess("✅ Payment successful! You are now Premium.");
      setTimeout(() => {
        router.replace(from === "generator" ? "/generator" : "/auth/profile");
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <RequireAuth>
      <div className="max-w-lg mx-auto p-6 bg-gray-800/80 rounded-2xl shadow-lg mt-12 text-white">
        <h1 className="text-3xl font-bold text-yellow-400 mb-4">Payment Checkout 💳</h1>
        <p className="text-gray-300 mb-6">
          Demo checkout page — enter any fake card info to simulate a payment. No real transaction occurs.
        </p>

        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 rounded bg-gray-900 border border-gray-700"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Cardholder Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-3 rounded bg-gray-900 border border-gray-700"
              placeholder="John Doe"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Card Number</label>
            <input
              type="text"
              value={card}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                setCard(val.replace(/(\d{4})(?=\d)/g, "$1 "));
              }}
              className="w-full p-3 rounded bg-gray-900 border border-gray-700"
              placeholder="4242 4242 4242 4242"
            />
          </div>

          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Expiry (MM/YY)</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^\d]/g, "").slice(0, 4);
                  if (v.length >= 3) v = `${v.slice(0, 2)}/${v.slice(2)}`;
                  setExpiry(v);
                }}
                className="w-full p-3 rounded bg-gray-900 border border-gray-700"
                placeholder="12/25"
              />
            </div>

            <div className="w-24">
              <label className="block text-sm text-gray-400 mb-1">CVC</label>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 3))}
                className="w-full p-3 rounded bg-gray-900 border border-gray-700"
                placeholder="123"
              />
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-gray-700 pt-4">
            <p className="text-lg font-semibold text-gray-200">Total: $9.99</p>
            <button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:opacity-90 text-black px-6 py-2 rounded-lg font-semibold disabled:opacity-60"
            >
              {loading ? "Processing…" : "Pay $9.99"}
            </button>
          </div>

          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          {success && <p className="text-green-400 text-sm mt-2">{success}</p>}
        </form>

        <p className="text-xs text-gray-500 mt-6">
          ⚠️ Demo only — no real payment is processed. This will simply upgrade your account to Premium.
        </p>
      </div>
    </RequireAuth>
  );
}
