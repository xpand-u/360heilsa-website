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
  const rawNext = searchParams.get("next") || "";
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

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
    <>
      <style>{`
        .login-root {
          min-height: 100dvh;
          background: ${T.bg};
          display: flex;
          align-items: stretch;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .login-brand {
          display: none;
        }
        .login-form-panel {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
        }
        .login-form-inner {
          width: 100%;
          max-width: 400px;
        }
        .login-logo-mobile {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 48px;
        }
        .field-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${T.muted};
          margin-bottom: 8px;
          display: block;
        }
        .field-input {
          width: 100%;
          padding: 15px 18px;
          font-size: 16px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          color: ${T.text};
          border-radius: 10px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s;
        }
        .field-input:focus {
          border-color: ${T.accent};
        }
        @media (min-width: 768px) {
          .login-brand {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: flex-start;
            flex: 0 0 45%;
            padding: 64px 56px;
            background: ${T.surface};
            border-right: 1px solid ${T.border};
          }
          .login-logo-mobile {
            display: none;
          }
          .login-form-panel {
            padding: 64px 72px;
          }
          .login-form-inner {
            max-width: 420px;
          }
        }
        @media (min-width: 1200px) {
          .login-brand {
            flex: 0 0 50%;
            padding: 80px 80px;
          }
          .login-form-panel {
            padding: 80px 100px;
          }
        }
      `}</style>

      <div className="login-root">
        {/* Brand panel — desktop only */}
        <div className="login-brand">
          <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "48px" }}>
            <img src="/logo-heilsa.png" alt="360" style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
            <div>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "28px", letterSpacing: "0.08em", color: T.text, lineHeight: 1.1 }}>COACH FRANKLIN</div>
              <div style={{ fontSize: "11px", letterSpacing: "0.14em", color: T.muted, textTransform: "uppercase", marginTop: "4px" }}>Elite Performance System</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <p style={{ fontSize: "28px", fontWeight: 300, lineHeight: 1.5, color: T.text, margin: 0, maxWidth: "420px" }}>
              Most coaches give you a program. I build a system around you.
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.8, color: T.muted, margin: 0, maxWidth: "400px" }}>
              Personalised training, movement screening, and adaptive programming — built around how you specifically move and recover.
            </p>
          </div>

          <div style={{ marginTop: "64px", display: "flex", flexDirection: "column", gap: "16px" }}>
            {[
              ["Intake conversation", "Tell me about your training history"],
              ["Lock in your schedule", "Days and times, into your calendar"],
              ["Movement screen", "5 self-tests, ~10 minutes"],
            ].map(([title, desc]) => (
              <div key={title} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.accent, marginTop: "7px", flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: T.text }}>{title}</div>
                  <div style={{ fontSize: "12px", color: T.muted, marginTop: "2px" }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form panel */}
        <div className="login-form-panel">
          <div className="login-form-inner">

            {/* Mobile logo */}
            <div className="login-logo-mobile">
              <img src="/logo-heilsa.png" alt="360" style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)", opacity: 0.9 }} />
              <div>
                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "22px", letterSpacing: "0.08em", color: T.text, lineHeight: 1.1 }}>COACH FRANKLIN</div>
                <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: T.muted, textTransform: "uppercase", marginTop: "3px" }}>Elite Performance System</div>
              </div>
            </div>

            <div style={{ marginBottom: "36px" }}>
              <h1 style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "32px", letterSpacing: "0.06em", color: T.text, margin: "0 0 8px" }}>SKRÁÐU ÞIG INN</h1>
              <p style={{ fontSize: "14px", color: T.muted, margin: 0 }}>Velkomin/n aftur</p>
            </div>

            <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label className="field-label">Netfang</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  autoComplete="email"
                  required
                  className="field-input"
                />
              </div>

              <div>
                <label className="field-label">Lykilorð</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="field-input"
                />
              </div>

              {error && (
                <p style={{ fontSize: "13px", color: T.red, margin: 0 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                style={{
                  width: "100%", padding: "17px", marginTop: "4px",
                  fontFamily: "'BebasNeue', sans-serif", fontSize: "18px", letterSpacing: "0.1em",
                  background: loading || !email || !password ? T.surface : T.accent,
                  color: loading || !email || !password ? T.muted : T.bg,
                  border: "none", borderRadius: "10px",
                  cursor: loading || !email || !password ? "default" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {loading ? "..." : "OPNA"}
              </button>
            </form>

            <p style={{ marginTop: "28px", fontSize: "14px", color: T.muted, textAlign: "center" }}>
              Ertu nýr?{" "}
              <Link href="/signup" style={{ color: T.accent, textDecoration: "none", fontWeight: 600 }}>
                Stofna aðgang
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
