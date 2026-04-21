"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";

const C = {
  gold: "#C9A84C", green: "#00E5A0", red: "#FF3A5C",
  base: "#04050A", surface: "#080B12", raised: "#0D1018",
  border: "#1A2035", borderMid: "#232B42",
  text: "#F0F4FF", dim: "#3D4760", muted: "#8892B0",
};

function GridDots() {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      backgroundImage: `radial-gradient(circle, rgba(201,168,76,0.06) 1px, transparent 1px)`,
      backgroundSize: "32px 32px",
      pointerEvents: "none",
    }} />
  );
}

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await api.login(username, password);
      localStorage.setItem("token", res.access_token);
      router.push("/");
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = (focused: boolean): React.CSSProperties => ({
    width: "100%",
    background: C.raised,
    border: `1px solid ${focused ? "rgba(201,168,76,0.4)" : C.borderMid}`,
    borderRadius: 4,
    padding: "10px 14px",
    color: C.text,
    fontFamily: "JetBrains Mono",
    fontSize: 13,
    outline: "none",
    transition: "border-color 0.15s",
    boxSizing: "border-box",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: C.base,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      position: "relative",
      overflow: "hidden",
    }}>
      <GridDots />

      {/* Glow orb */}
      <div style={{
        position: "absolute",
        top: "30%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 600,
        height: 600,
        background: "radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 380,
          margin: "0 24px",
        }}
      >
        {/* Logo area */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              border: `1px solid rgba(201,168,76,0.3)`,
              borderRadius: 8,
              marginBottom: 16,
              background: "rgba(201,168,76,0.05)",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke={C.gold} strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 18, fontWeight: 700, color: C.gold, letterSpacing: "0.12em" }}>
              ALGO
            </div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 10, fontWeight: 400, color: C.muted, letterSpacing: "0.25em", marginTop: 2 }}>
              TERMINAL v1.0
            </div>
          </motion.div>
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderTop: `1px solid rgba(201,168,76,0.2)`,
            borderRadius: 8,
            padding: "32px 28px",
            boxShadow: "0 0 40px rgba(0,0,0,0.4), 0 0 80px rgba(201,168,76,0.03), inset 0 1px 0 rgba(201,168,76,0.06)",
          }}
        >
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>Sign in</div>
            <div style={{ fontSize: 12, color: C.dim }}>Access the trading terminal</div>
          </div>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{
                display: "block",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.dim,
                marginBottom: 6,
              }}>
                Username
              </label>
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
                style={inputStyle(false)}
                onFocus={e => (e.target.style.borderColor = "rgba(201,168,76,0.4)")}
                onBlur={e => (e.target.style.borderColor = C.borderMid)}
              />
            </div>

            <div>
              <label style={{
                display: "block",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: C.dim,
                marginBottom: 6,
              }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                style={inputStyle(false)}
                onFocus={e => (e.target.style.borderColor = "rgba(201,168,76,0.4)")}
                onBlur={e => (e.target.style.borderColor = C.borderMid)}
              />
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  padding: "8px 12px",
                  background: "rgba(255,58,92,0.08)",
                  border: "1px solid rgba(255,58,92,0.2)",
                  borderRadius: 4,
                  fontSize: 12,
                  color: C.red,
                }}
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              style={{
                marginTop: 4,
                width: "100%",
                padding: "11px",
                background: loading || !username || !password
                  ? C.raised
                  : "rgba(201,168,76,0.12)",
                border: `1px solid ${loading || !username || !password
                  ? C.border
                  : "rgba(201,168,76,0.4)"}`,
                borderRadius: 4,
                color: loading || !username || !password ? C.dim : C.gold,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.12em",
                cursor: loading || !username || !password ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                fontFamily: "JetBrains Mono",
              }}
            >
              {loading ? "AUTHENTICATING…" : "ACCESS TERMINAL"}
            </button>
          </form>
        </motion.div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 24, fontSize: 10, color: C.dim, letterSpacing: "0.08em" }}>
          ALGO TERMINAL · PAPER ACCOUNT · IBKR CONNECTED
        </div>
      </motion.div>
    </div>
  );
}
