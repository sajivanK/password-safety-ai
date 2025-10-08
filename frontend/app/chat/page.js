"use client"
import { useState, useEffect } from "react"

import RequireAuth from "@/components/RequireAuth";

import Link from "next/link"; // 🔗 for premium CTA


const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"

export default function ChatOrchestratorPage() {
  const [plan, setPlan] = useState("normal")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  //const [status, setStatus] = useState({ guardian: null, watchdog: null, generator: null })

  // --- Copy helper ---
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
  }

  // --- Auto-apply user plan from localStorage on mount (NEW) ---
  // If the user logged in via frontend, we saved `psai_status` in localStorage ("normal" | "premium").
  // This ensures premium users automatically get premium behavior without manually selecting it each time.
  useEffect(() => {
    try {
      const stored = localStorage.getItem("psai_status")
      if (stored === "premium") setPlan("premium")
      else if (stored === "normal") setPlan("normal")
      // if nothing stored, keep default "normal"
    } catch {
      // ignore read errors, keep default plan
    }
  }, [])

  // --- Health checks on mount ---


  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg = { role: "user", text: input }
    setMessages((m) => [...m, userMsg])

    // Typing indicator
    setMessages((m) => [...m, { role: "bot", text: "•••", typing: true }])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch(`${API_BASE}/orchestrator/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.text, plan }),
      })
      const data = await res.json()
      const botMsg = { role: "bot", text: data.chat, ui: data.ui, warnings: data.warnings }

      setMessages((m) => [...m.filter((msg) => !msg.typing), botMsg]) // remove typing bubble
    } catch (err) {
      setMessages((m) => [...m.filter((msg) => !msg.typing), { role: "bot", text: "⚠️ Orchestrator not reachable." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    // 🔒 ADDED: protect this page so only logged-in users can view it
    <RequireAuth>
      <div className="flex flex-col flex-1 p-6 text-white">
        {/* Header with health dots */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Chat with Orchestrator 🤖</h1>
          
        </div> 

        {/* Chat Card */}
        <div className="flex flex-col flex-1 bg-gradient-to-br from-blue-900/40 via-purple-900/30 to-gray-900/40 
                        rounded-2xl shadow-xl border border-white/10 p-4">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-2 mb-4">
            {messages.length === 0 && (
              <p className="text-center text-sm text-gray-300 mt-20">
                Try: <span className="italic opacity-80">check if &apos;Summer2024!&apos; is safe and suggest stronger</span>
              </p>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
                <div
                  className={`inline-block max-w-[80%] px-4 py-2 rounded-xl text-sm shadow-md ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                      : "bg-black/40 border border-white/10 text-gray-100"
                  }`}
                >
                  {msg.text}
                </div>

                {/* Bot extras (cards) */}
                {msg.role === "bot" && msg.ui && (
                  <div className="mt-2 space-y-2">
                    {msg.ui.strength && (
                      <div className="p-3 bg-black/30 border border-white/10 rounded-lg shadow">
                        <b>Strength:</b> Score {msg.ui.strength.score}/4
                      </div>
                    )}
                    {msg.ui.breach && (
                      <div className="p-3 bg-black/30 border border-white/10 rounded-lg shadow">
                        <b>Breach:</b>{" "}
                        {plan === "normal" ? (
                          // 🟡 NEW: tiny CTA to upgrade
                          <span>
                            🔒 Breach check is Premium only.{" "}
                            <Link href="/billing/upgrade" className="underline text-yellow-300 hover:opacity-80">
                              Upgrade
                            </Link>
                          </span>
                        ) : msg.ui.breach.breached ? (
                          `Found in ${msg.ui.breach.count} breaches`
                        ) : (
                          "No breaches found"
                        )}
                      </div>
                    )}

                    {msg.ui.suggestions && (
                      <div className="p-3 bg-black/30 border border-white/10 rounded-lg shadow space-y-2">
                        <b>Suggestions:</b>
                        <div className="flex flex-col gap-2 mt-2">
                          {msg.ui.suggestions.map((sug, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-md">
                              <span className="truncate">{sug}</span>
                              <button
                                onClick={() => copyToClipboard(sug)}
                                className="text-xs bg-violet-600 hover:bg-violet-700 px-2 py-1 rounded-md"
                              >
                                Copy
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {msg.warnings && msg.warnings.length > 0 && (
                      <div className="p-3 bg-yellow-100 text-yellow-900 rounded-lg shadow">
                        ⚠️ {msg.warnings.join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Input Bar (inside card, rounded) */}
          <div className="flex items-center gap-2 border-t border-white/10 pt-3">
            {/* Plan selector: currently left enabled for manual override.
                If you want it locked to the user plan, add `disabled` and a visual hint (e.g., opacity-60). */}
            <select
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500"
            >
              <option value="normal">Normal</option>
              <option value="premium">Premium</option>
            </select>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Type your request..."
              maxLength={500}
              className="flex-1 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="bg-gradient-to-r from-purple-600 to-blue-600 px-4 py-2 rounded-lg text-white font-medium shadow-md hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </RequireAuth>
  )
}
