"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const T = {
  bg: "#0c0c0b",
  surface: "#141413",
  border: "#222220",
  text: "#f0ede8",
  muted: "#6b6860",
  accent: "#c8a96e",
  red: "#f85149",
  green: "#3fb950",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "14px 16px", fontSize: "16px",
  background: T.surface, border: `1px solid ${T.border}`,
  color: T.text, borderRadius: "8px", outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em",
  textTransform: "uppercase", color: T.muted, marginBottom: "8px",
  display: "block",
};

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = name.trim().length > 0 && email.trim().length > 0 && password.length >= 8;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }
      // Log in immediately after signup
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (loginRes.ok) {
        router.push("/onboarding");
      } else {
        router.push("/login");
      }
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
          <img src="/logo-heilsa.png" alt="360 Heilsa" style={{ height: "36px", width: "auto", display: "block", marginBottom: "8px", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
          <p style={{ fontSize: "14px", color: T.muted }}>
            Stofnaðu aðgang
          </p>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Nafn</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              autoComplete="name"
              placeholder="Fullt nafn"
              required
              style={{ ...inputStyle, "::placeholder": { color: T.muted } } as React.CSSProperties}
            />
          </div>

          <div>
            <label style={labelStyle}>Netfang</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle}>Lykilorð</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={8}
              style={inputStyle}
            />
            {password.length > 0 && password.length < 8 && (
              <p style={{ fontSize: "12px", color: T.muted, marginTop: "6px" }}>
                Að minnsta kosti 8 stafir
              </p>
            )}
          </div>

          {error && (
            <p style={{ fontSize: "13px", color: T.red }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit}
            style={{
              width: "100%", padding: "15px", fontSize: "12px", fontWeight: 700,
              letterSpacing: "0.12em", textTransform: "uppercase",
              background: loading || !canSubmit ? T.surface : T.accent,
              color: loading || !canSubmit ? T.muted : "#0c0c0b",
              border: "none", borderRadius: "8px",
              cursor: loading || !canSubmit ? "default" : "pointer",
              transition: "background 0.15s",
              marginTop: "8px",
            }}
          >
            {loading ? "..." : "STOFNA AÐGANG"}
          </button>
        </form>

        <p style={{ marginTop: "24px", fontSize: "13px", color: T.muted, textAlign: "center" }}>
          Ertu nú þegar með aðgang?{" "}
          <Link href="/login" style={{ color: T.accent, textDecoration: "none" }}>
            Skrá inn
          </Link>
        </p>
      </div>
    </div>
  );
}
