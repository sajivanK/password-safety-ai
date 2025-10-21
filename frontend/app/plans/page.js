"use client";

import Link from "next/link";
import RequireAuth from "@/components/RequireAuth";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function PlansPage() {
  const router = useRouter();
  const params = useSearchParams();

  // 🧭 Detect source (optional: e.g., from=chat, from=vault)
  const from = params.get("from");

  // Scroll to top when entering
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <RequireAuth>
      <div className="max-w-3xl mx-auto p-6 mt-10 bg-gray-800/70 rounded-2xl shadow-lg text-white">
        <h1 className="text-4xl font-bold text-center text-yellow-400 mb-8">
          Choose Your Plan
        </h1>

        {/* 🧩 Optional hint if redirected from a restricted feature */}
        {from && (
          <p className="text-center text-sm text-yellow-300 mb-6">
            You were redirected here from <b>{from}</b> — upgrade to unlock full features 🔓
          </p>
        )}

        {/* Feature Comparison Table */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <div className="border border-gray-700 rounded-xl p-6 bg-gray-900/70">
            <h2 className="text-2xl font-bold text-purple-400 mb-4">Free Plan</h2>
            <ul className="space-y-2 text-gray-300">
              <li>✅ Deterministic Passwords</li>
              <li>✅ LLM-based Gemini Passphrases</li>
              <li>❌ Multilingual Password Generator</li>
              <li>❌ Advanced Breach Insights</li>
              <li>❌ Chat Orchestration AI</li>
              <li>❌ Unlimited Vault Storage</li>
            </ul>
            <p className="mt-6 text-gray-400 text-sm">
              Ideal for personal use and basic password creation.
            </p>
            <button
              onClick={() => router.push("/generator")}
              className="mt-4 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white w-full"
            >
              Continue Free
            </button>
          </div>

          {/* Premium Plan */}
          <div className="border border-yellow-500 rounded-xl p-6 bg-gray-900/70">
            <h2 className="text-2xl font-bold text-yellow-400 mb-4">Premium Plan</h2>
            <ul className="space-y-2 text-gray-200">
              <li>✅ All Free Features</li>
              <li>✅ Multilingual Passwords (AI Transliteration)</li>
              <li>✅ Breach Checker Access</li>
              <li>✅ AI Chat Orchestration</li>
              <li>✅ Unlimited Vault Storage</li>
              <li>✅ Early Access to New Tools</li>
            </ul>
            <p className="mt-6 text-gray-400 text-sm">
              Designed for professionals and security enthusiasts.
            </p>

            {/* 🧾 Correct checkout link */}
            <Link
              href={`/billing/checkout?from=${from || "plans"}`}
              className="mt-4 inline-block text-center bg-gradient-to-r from-yellow-500 to-orange-600 text-black px-6 py-2 rounded-lg font-semibold hover:opacity-90 w-full"
            >
              Upgrade to Premium 🚀
            </Link>
          </div>
        </div>

        {/* 🪪 Footer hint */}
        <div className="mt-8 text-center text-gray-400 text-sm">
          All payments are securely simulated for demo purposes.  
          You can cancel or upgrade anytime.
        </div>
      </div>
    </RequireAuth>
  );
}