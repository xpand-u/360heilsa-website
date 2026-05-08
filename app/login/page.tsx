"use client";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const T = {
  bg: "#0c0c0b",
  surface: "#141413",
  border: "#222220",
  text: "#f0ede8",
  muted: "#6b6860",
  accent: "#c8a96e",
  red: "#f85149",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }
      router.push(next);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: T.bg,
        padding: "24px 16px",
      }}
    >
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ marginBottom: "40px" }}>
          <p style={{
            fontFamily: "'BebasNeue', sans-serif",
            fontSize: "clamp(28px, 6vw, 36px)",
            color: T.accent,
            letterSpacing: "0.08em",
            marginBottom: "8px",
          }}>
            360 HEILSA
          </p>
          <p style={{ fontSize: "14px", color: T.muted }}>
            Skráðu þig inn
          </p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <p style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: T.muted, marginBottom: "8px",
            }}>
              Netfang
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
              required
              style={{
                width: "100%", padding: "14px 16px", fontSize: "16px",
                background: T.surface, border: `1px solid ${T.border}`,
                color: T.text, borderRadius: "8px", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <p style={{
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
              textTransform: "uppercase", color: T.muted, marginBottom: "8px",
            }}>
              Lykilorð
            </p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: "100%", padding: "14px 16px", fontSize: "16px",
                background: T.surface, border: `1px solid ${T.border}`,
                color: T.text, borderRadius: "8px", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {error && (
            <p style={{ fontSize: "13px", color: T.red }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: "100%", padding: "15px", fontSize: "12px", fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: loading || !email || !password ? T.surface : T.accent,
              color: loading || !email || !password ? T.muted : "#0c0c0b",
              border: "none", borderRadius: "8px", cursor: loading ? "wait" : "pointer",
              transition: "background 0.15s",
              marginTop: "8px",
            }}
          >
            {loading ? "..." : "OPNA"}
          </button>
        </form>

        <p style={{ marginTop: "24px", fontSize: "13px", color: T.muted, textAlign: "center" }}>
          Ertu nýr?{" "}
          <Link href="/signup" style={{ color: T.accent, textDecoration: "none" }}>
            Stofna aðgang
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
