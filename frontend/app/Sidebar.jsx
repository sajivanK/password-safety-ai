"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ShieldAlert,
  BarChart3,
  Settings,
  KeyRound,
  MessageSquare,
  User as UserIcon,
  LogOut,
  Lock,
} from "lucide-react";

import { validateSession, clearSession } from "@/utils/session"; // ✅ NEW

function SidebarLink({ href, label, Icon }) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive
          ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md"
          : "text-gray-300 hover:bg-gray-700 hover:text-white"
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  // 🔐 Do NOT rely on "token exists" — validate with backend first
  const [mounted, setMounted] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [plan, setPlan] = useState("normal");

  // Validate token on mount
  useEffect(() => {
    let alive = true;
    async function boot() {
      const res = await validateSession();
      if (!alive) return;

      if (!res.ok) {
        setAuthed(false);
        setMounted(true);
        return; // Sidebar will render null (hidden)
      }
      setAuthed(true);
      setPlan(res.status || "normal");
      setMounted(true);
    }
    boot();

    // Re-validate on cross-tab changes
    const onStorage = () => boot();
    const onAuthChanged = () => boot();
    window.addEventListener("storage", onStorage);
    window.addEventListener("psai:auth-changed", onAuthChanged);
    return () => {
      alive = false;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("psai:auth-changed", onAuthChanged);
    };
  }, []);

  // Also re-validate when the route changes (prevents flashing on /auth routes)
  useEffect(() => {
    let alive = true;
    async function check() {
      const res = await validateSession();
      if (!alive) return;

      if (!res.ok) {
        setAuthed(false);
        return;
      }
      setAuthed(true);
      setPlan(res.status || "normal");
    }
    check();
    return () => {
      alive = false;
    };
  }, [pathname]);

  // Never show sidebar unless we have validated auth
  if (!mounted || !authed) return null;

  function signOut() {
    clearSession(); // clears LS + broadcasts
    router.replace("/auth/login");
  }

  return (
    <aside className="w-64 bg-gradient-to-br from-blue-900 via-purple-900 to-gray-900 flex-col p-6 hidden md:flex shadow-xl rounded-r-2xl my-10 ">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Password AI
        </h1>
        <span
          className={`text-xs px-2 py-1 rounded ${
            plan === "premium" ? "bg-yellow-400 text-black" : "bg-white/10 text-white"
          }`}
          title={`Current plan: ${plan}`}
        >
          {plan === "premium" ? "PREMIUM" : "NORMAL"}
        </span>
      </div>

      <nav className="flex flex-col gap-3">
        <SidebarLink href="/" label="Dashboard" Icon={LayoutDashboard} />
        <SidebarLink href="/auth/profile" label="User Profile" Icon={UserIcon} />
        {/*plan === "premium" && (
          <SidebarLink href="/breach" label="Breach Check" Icon={ShieldAlert} />
        )*/}
        <SidebarLink href="/generator" label="Password Generator" Icon={KeyRound} />
        <SidebarLink href="/vault" label="Password Manager" Icon={Lock} />
        <SidebarLink href="/chat" label="Chat Orchestrator" Icon={MessageSquare} />
        {/*<SidebarLink href="/reports" label="Reports" Icon={BarChart3} />*/}
        {/*<SidebarLink href="/settings" label="Settings" Icon={Settings} />*/}
      </nav>

      <button
        onClick={signOut}
        className="mt-6 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
      >
        <LogOut className="w-5 h-5" />
        Sign out
      </button>
    </aside>
  );
}
