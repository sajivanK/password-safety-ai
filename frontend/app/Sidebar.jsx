"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShieldAlert,
  BarChart3,
  Settings,
  KeyRound,
} from "lucide-react";

function SidebarLink({ href, label, Icon }) {
  const pathname = usePathname();
  const isActive = pathname === href;

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
  return (
    <aside className="w-64 bg-gradient-to-br from-blue-900 via-purple-900 to-gray-900 flex-col p-6 hidden md:flex shadow-xl rounded-r-2xl my-10 ">
      <h1 className="text-2xl font-extrabold mb-8 bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
        Password AI
      </h1>
      <nav className="flex flex-col gap-3">
        <SidebarLink href="/" label="Dashboard" Icon={LayoutDashboard} />
        <SidebarLink href="/breach" label="Breach Check" Icon={ShieldAlert} />
        <SidebarLink href="/generator" label="Password Generator" Icon={KeyRound} />
        <SidebarLink href="/reports" label="Reports" Icon={BarChart3} />
        <SidebarLink href="/settings" label="Settings" Icon={Settings} />
      </nav>
    </aside>
  );
}
