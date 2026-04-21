"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard, BarChart2, TrendingUp, Activity,
  BookOpen, Settings, Brain, LogOut, Zap, FlaskConical,
} from "lucide-react";

const links = [
  { href: "/",            label: "Overview",    icon: LayoutDashboard },
  { href: "/trading",     label: "Trading",     icon: BarChart2 },
  { href: "/performance", label: "Performance", icon: TrendingUp },
  { href: "/analytics",   label: "Analytics",   icon: Activity },
  { href: "/ml",          label: "ML Model",    icon: Brain },
  { href: "/backtest",    label: "Backtest",    icon: FlaskConical },
  { href: "/journal",     label: "Journal",     icon: BookOpen },
  { href: "/controls",    label: "Controls",    icon: Settings },
];

export default function Sidebar() {
  const path = usePathname();

  return (
    <motion.aside
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      style={{
        width: 200,
        background: "#080B12",
        borderRight: "1px solid #1A2035",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      {/* Brand */}
      <div style={{ padding: "16px 20px 20px", borderBottom: "1px solid #1A2035" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: "rgba(201,168,76,0.1)",
            border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Zap size={14} style={{ color: "#C9A84C" }} />
          </div>
          <div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 700, color: "#C9A84C", letterSpacing: "0.1em" }}>ALGO</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 8, fontWeight: 400, color: "#3D4760", letterSpacing: "0.2em" }}>TERMINAL v1.0</div>
          </div>
        </div>
      </div>

      {/* Nav section label */}
      <div style={{ padding: "16px 20px 8px" }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "#3D4760" }}>
          Navigation
        </span>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: "0 10px", display: "flex", flexDirection: "column", gap: 2 }}>
        {links.map(({ href, label, icon: Icon }, i) => {
          const active = path === href;
          return (
            <motion.div
              key={href}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.04 }}
            >
              <Link href={href} style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  background: active ? "rgba(201,168,76,0.08)" : "transparent",
                  borderLeft: active ? "2px solid #C9A84C" : "2px solid transparent",
                  transition: "all 0.15s",
                  position: "relative",
                }}>
                  <Icon
                    size={15}
                    style={{ color: active ? "#C9A84C" : "#3D4760", flexShrink: 0, transition: "color 0.15s" }}
                  />
                  <span style={{
                    fontSize: 12,
                    fontWeight: active ? 600 : 400,
                    color: active ? "#F0F4FF" : "#8892B0",
                    transition: "color 0.15s",
                    letterSpacing: "0.01em",
                  }}>
                    {label}
                  </span>
                  {active && (
                    <motion.div
                      layoutId="active-indicator"
                      style={{
                        position: "absolute", right: 10,
                        width: 4, height: 4, borderRadius: "50%",
                        background: "#C9A84C",
                        boxShadow: "0 0 6px rgba(201,168,76,0.6)",
                      }}
                    />
                  )}
                </div>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Bottom: sign out */}
      <div style={{ padding: "12px 10px 0", borderTop: "1px solid #1A2035" }}>
        <button
          onClick={() => { localStorage.removeItem("token"); window.location.href = "/login"; }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 6,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,58,92,0.08)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <LogOut size={14} style={{ color: "#3D4760" }} />
          <span style={{ fontSize: 12, color: "#3D4760", letterSpacing: "0.01em" }}>Sign Out</span>
        </button>
      </div>
    </motion.aside>
  );
}
