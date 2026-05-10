"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

const T = {
  bg: "#0c0c0b", surface: "#141413", border: "#222220",
  text: "#f0ede8", muted: "#6b6860", accent: "#c8a96e",
  red: "#f85149", green: "#3fb950",
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const valid = password.length >= 8 && password === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 2000);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center",
      background: T.bg, padding: "24px 16px", fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <img src="/logo-heilsa.png" alt="360 Heilsa" style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)", display: "block", marginBottom: "8px" }} />
        <p style={{ fontSize: "14px", color: T.muted, marginBottom: "32px" }}>Set a new password</p>

        {done ? (
          <div style={{ fontSize: "14px", color: T.green, textAlign: "center" }}>
            ✓ Password updated — redirecting…
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "8px" }}>
                New password
              </p>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="new-password"
                required
                minLength={8}
                style={{
                  width: "100%", padding: "14px 16px", fontSize: "16px",
                  background: T.surface, border: `1px solid ${T.border}`,
                  color: T.text, borderRadius: "8px", outline: "none", boxSizing: "border-box",
                }}
              />
              {password.length > 0 && password.length < 8 && (
                <p style={{ fontSize: "12px", color: T.muted, marginTop: "6px" }}>At least 8 characters</p>
              )}
            </div>

            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "8px" }}>
                Confirm password
              </p>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                style={{
                  width: "100%", padding: "14px 16px", fontSize: "16px",
                  background: T.surface, border: `1px solid ${confirm && confirm !== password ? T.red : T.border}`,
                  color: T.text, borderRadius: "8px", outline: "none", boxSizing: "border-box",
                }}
              />
              {confirm && confirm !== password && (
                <p style={{ fontSize: "12px", color: T.red, marginTop: "6px" }}>Passwords don&apos;t match</p>
              )}
            </div>

            {error && <p style={{ fontSize: "13px", color: T.red }}>{error}</p>}

            <button
              type="submit"
              disabled={loading || !valid}
              style={{
                width: "100%", padding: "15px", fontSize: "12px", fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
                background: loading || !valid ? T.surface : T.accent,
                color: loading || !valid ? T.muted : T.bg,
                border: "none", borderRadius: "8px",
                cursor: loading || !valid ? "default" : "pointer",
                transition: "background 0.15s", marginTop: "8px",
              }}
            >
              {loading ? "…" : "SET PASSWORD"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
