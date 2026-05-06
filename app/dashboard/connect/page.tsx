"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const T = {
  bg:        "#0c0c0b",
  surface:   "#141413",
  surface2:  "#1a1a18",
  border:    "#222220",
  text:      "#f0ede8",
  muted:     "#6b6860",
  accent:    "#c8a96e",
  accentDim: "rgba(200,169,110,0.12)",
  green:     "#3fb950",
  red:       "#f85149",
};

const PROVIDERS = [
  { name: "Garmin",      icon: "⌚", desc: "Garmin Connect" },
  { name: "Whoop",       icon: "💪", desc: "WHOOP strap" },
  { name: "Oura",        icon: "💍", desc: "Oura Ring" },
  { name: "Ultrahuman",  icon: "💎", desc: "Ultrahuman Ring AIR" },
  { name: "Polar",       icon: "🔵", desc: "Polar devices" },
  { name: "Apple",       icon: "🍎", desc: "Apple Watch / Health" },
  { name: "Fitbit",      icon: "📊", desc: "Fitbit devices" },
  { name: "Withings",    icon: "⚖️", desc: "Withings scales & watches" },
];

// Use Rafn's athlete ID for now — Phase 2: derive from authenticated session
const ATHLETE_ID = process.env.NEXT_PUBLIC_RAFN_ATHLETE_ID || "";

function ConnectContent() {
  const params = useSearchParams();
  const success = params.get("success") === "true";
  const error   = params.get("error") === "true";

  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  useEffect(() => {
    if (error) setErr("Connection failed. Please try again.");
  }, [error]);

  async function connect() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/terra/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athlete_id: ATHLETE_ID }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setErr(data.error || "Failed to start connection.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr("Network error. Try again.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      background: T.bg, minHeight: "100vh", color: T.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "24px",
    }}>
      {/* Logo */}
      <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.8rem", letterSpacing: "0.1em", color: T.accent, marginBottom: "40px" }}>
        360 HEILSA
      </div>

      <div style={{ width: "100%", maxWidth: "480px" }}>

        {success ? (
          /* ── Success state ── */
          <div style={{ background: T.surface, border: `1px solid ${T.green}40`, borderRadius: "16px", padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "16px" }}>✓</div>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "2rem", color: T.green, letterSpacing: "0.06em", marginBottom: "8px" }}>
              CONNECTED
            </div>
            <p style={{ fontSize: "14px", color: T.muted, lineHeight: 1.6, marginBottom: "28px" }}>
              Your wearable is connected. Health data will sync automatically each morning — HRV, sleep, resting heart rate, steps, and more.
            </p>
            <a href="/dashboard" style={{
              display: "inline-block", background: T.accent, color: T.bg,
              fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em",
              padding: "12px 32px", borderRadius: "10px", textDecoration: "none",
            }}>
              GO TO DASHBOARD
            </a>
          </div>
        ) : (
          /* ── Connect state ── */
          <>
            <div style={{ marginBottom: "32px" }}>
              <h1 style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "2.2rem", letterSpacing: "0.06em", marginBottom: "8px" }}>
                CONNECT YOUR WEARABLE
              </h1>
              <p style={{ fontSize: "14px", color: T.muted, lineHeight: 1.65 }}>
                Connect your device once. Your coach receives daily readiness data — HRV, sleep quality, resting heart rate — automatically. No manual logging.
              </p>
            </div>

            {/* Supported devices grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "28px",
            }}>
              {PROVIDERS.map(p => (
                <div key={p.name} style={{
                  background: T.surface, border: `1px solid ${T.border}`,
                  borderRadius: "10px", padding: "14px 16px",
                  display: "flex", alignItems: "center", gap: "10px",
                }}>
                  <span style={{ fontSize: "1.4rem" }}>{p.icon}</span>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: "11px", color: T.muted }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* What gets shared */}
            <div style={{
              background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: "10px", padding: "16px 20px", marginBottom: "24px",
            }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "10px" }}>
                Data your coach receives
              </div>
              {[
                ["HRV (SDNN)", "Used to assess recovery and adjust training load"],
                ["Sleep duration & stages", "Deep, REM, and light sleep breakdown"],
                ["Resting heart rate", "Daily baseline for cardiovascular readiness"],
                ["Steps & active energy", "Daily movement context"],
              ].map(([label, desc]) => (
                <div key={label} style={{ display: "flex", gap: "10px", marginBottom: "8px", fontSize: "12px" }}>
                  <span style={{ color: T.accent, marginTop: "1px" }}>·</span>
                  <div>
                    <span style={{ color: T.text, fontWeight: 600 }}>{label}</span>
                    <span style={{ color: T.muted }}> — {desc}</span>
                  </div>
                </div>
              ))}
            </div>

            {err && (
              <div style={{
                background: "rgba(248,81,73,0.08)", border: `1px solid ${T.red}40`,
                borderRadius: "8px", padding: "10px 14px", marginBottom: "16px",
                fontSize: "13px", color: T.red,
              }}>
                {err}
              </div>
            )}

            <button
              onClick={connect}
              disabled={loading}
              style={{
                width: "100%", background: T.accent, border: "none",
                borderRadius: "12px", color: T.bg, cursor: loading ? "default" : "pointer",
                fontFamily: "'BebasNeue', sans-serif", fontSize: "1.2rem",
                fontWeight: 700, letterSpacing: "0.08em",
                padding: "16px", opacity: loading ? 0.7 : 1,
                transition: "opacity 0.2s",
              }}
            >
              {loading ? "OPENING CONNECTION…" : "CONNECT YOUR DEVICE"}
            </button>

            <p style={{ fontSize: "11px", color: T.muted, textAlign: "center", marginTop: "14px" }}>
              Secure OAuth — we never see your wearable password. Read-only access to health data only.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ConnectPage() {
  return (
    <Suspense>
      <ConnectContent />
    </Suspense>
  );
}
