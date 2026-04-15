"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
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

  return (
    <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
      <div className="bg-[#1A1D24] border border-[#30363D] rounded p-8 w-full max-w-sm">
        <h1 className="text-[#E6EDF3] font-sans font-semibold text-xl mb-1">
          Trading Terminal
        </h1>
        <p className="text-[#8B949E] text-sm mb-6">Sign in to continue</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-[#8B949E] text-xs uppercase tracking-wider block mb-1">
              Username
            </label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-[#21262D] border border-[#30363D] text-[#E6EDF3]
                         rounded px-3 py-2 text-sm outline-none
                         focus:border-[#2E7D9E] transition-colors"
            />
          </div>
          <div>
            <label className="text-[#8B949E] text-xs uppercase tracking-wider block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#21262D] border border-[#30363D] text-[#E6EDF3]
                         rounded px-3 py-2 text-sm outline-none
                         focus:border-[#2E7D9E] transition-colors"
            />
          </div>
          {error && <p className="text-[#FF4444] text-xs">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2E7D9E] hover:opacity-80 text-white
                       font-medium py-2 rounded text-sm transition-opacity
                       disabled:opacity-50">
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
