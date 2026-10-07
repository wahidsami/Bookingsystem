"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-950">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-950 via-[#0e0728] to-dark-950 p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary-700/15 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-4 px-7 rounded-2xl bg-white shadow-2xl shadow-primary-950/40 border border-purple-100/60 mb-5 ring-1 ring-white/60">
            <img
              src="/barspalogo.png"
              alt="BARSPA"
              className="h-16 sm:h-20 w-auto max-w-[240px] object-contain drop-shadow-sm"
            />
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">BARSPA Admin</h1>
          <p className="text-primary-200/80 text-sm mt-1.5 font-medium tracking-wide">
            BARSPA Admin Dashboard
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-800/95 backdrop-blur-xl border border-dark-700/80 hover:border-primary-500/30 rounded-2xl p-8 shadow-2xl shadow-black/40 transition-all">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white tracking-tight">Welcome back</h2>
            <p className="text-xs text-dark-400 mt-1">Sign in with your administrator credentials</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm flex items-start gap-2.5">
              <span className="text-base shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input py-2.5 bg-dark-900/70 border-dark-600/80 text-white placeholder-dark-500 rounded-xl text-sm"
                placeholder="admin@barspa.com"
                required
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-dark-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input py-2.5 bg-dark-900/70 border-dark-600/80 text-white placeholder-dark-500 rounded-xl text-sm"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full py-3 rounded-xl font-semibold text-sm shadow-lg shadow-primary-600/20 active:scale-[0.99] transition-all"
            >
              {loading ? (
                <>
                  <div className="spinner w-4 h-4"></div>
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-dark-700/60 flex items-center justify-center gap-1.5 text-dark-400 text-xs">
            <span>🔒</span>
            <span>Protected area. Authorized personnel only.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

