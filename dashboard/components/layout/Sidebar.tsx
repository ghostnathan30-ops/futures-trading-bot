"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, BarChart2, TrendingUp, Activity,
  BookOpen, Settings, Brain, LogOut
} from "lucide-react";

const links = [
  { href: "/",            label: "Overview",    icon: LayoutDashboard },
  { href: "/trading",     label: "Trading",     icon: BarChart2 },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/analytics",   label: "Analytics",   icon: Activity },
  { href: "/ml",          label: "ML Model",    icon: Brain },
  { href: "/journal",     label: "Journal",     icon: BookOpen },
  { href: "/controls",    label: "Controls",    icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <aside className="w-14 bg-[#1A1D24] border-r border-[#30363D] flex flex-col items-center py-3 gap-1 shrink-0">
      {links.map(({ href, label, icon: Icon }) => {
        const active = path === href;
        return (
          <Link key={href} href={href} title={label}
            className={`w-10 h-10 flex items-center justify-center rounded
              transition-colors group relative
              ${active ? "bg-[#2E7D9E]/20 text-[#2E7D9E]" : "text-[#484F58] hover:text-[#8B949E] hover:bg-[#21262D]"}`}>
            <Icon size={18} />
            <span className="absolute left-14 bg-[#21262D] border border-[#30363D] text-[#E6EDF3]
              text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100
              pointer-events-none transition-opacity z-50">
              {label}
            </span>
          </Link>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={() => { localStorage.removeItem("token"); window.location.href="/login"; }}
        title="Sign out"
        className="w-10 h-10 flex items-center justify-center rounded text-[#484F58] hover:text-[#FF4444] transition-colors">
        <LogOut size={16} />
      </button>
    </aside>
  );
}
