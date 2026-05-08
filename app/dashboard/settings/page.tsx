"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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
  yellow:    "#d29922",
  red:       "#f85149",
};

const PROVIDER_META: Record<string, { icon: string; label: string }> = {
  GARMIN:     { icon: "⌚", label: "Garmin" },
  OURA:       { icon: "💍", label: "Oura Ring" },
  WHOOP:      { icon: "💪", label: "Whoop" },
  POLAR:      { icon: "🔵", label: "Polar" },
  APPLE:      { icon: "🍎", label: "Apple Health" },
  FITBIT:     { icon: "📊", label: "Fitbit" },
  WITHINGS:   { icon: "⚖️", label: "Withings" },
  ULTRAHUMAN: { icon: "💎", label: "Ultrahuman" },
  SAMSUNG:    { icon: "📱", label: "Samsung" },
  GOOGLE:     { icon: "🔍", label: "Google Fit" },
};

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "8px" }}>
      {children}
    </p>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden" }}>
      {children}
    </div>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}` }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
        {title}
      </div>
      {subtitle && <div style={{ fontSize: "12px", color: T.muted, marginTop: "3px" }}>{subtitle}</div>}
    </div>
  );
}

function SettingsContent() {
  const params = useSearchParams();
  const justConnected = params.get("success") === "true";

  const [connections, setConnections]   = useState<any[]>([]);
  const [loadingConns, setLoadingConns] = useState(true);
  const [connecting, setConnecting]     = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [connectErr, setConnectErr]     = useState<string | null>(null);
  const [banner, setBanner]             = useState(justConnected ? "Wearable connected successfully." : null);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarCopied, setCalendarCopied] = useState(false);

  useEffect(() => {
    fetchConnections();
    fetchCalendarToken();
  }, []);

  useEffect(() => {
    if (banner) {
      const t = setTimeout(() => setBanner(null), 4000);
      return () => clearTimeout(t);
    }
  }, [banner]);

  async function fetchConnections() {
    setLoadingConns(true);
    const res = await fetch("/api/terra/connections");
    const d = await res.json();
    setConnections(d.connections || []);
    setLoadingConns(false);
  }

  async function fetchCalendarToken() {
    const res = await fetch("/api/onboarding/status");
    const d = await res.json();
    if (d.calendar_token) setCalendarToken(d.calendar_token);
  }

  function getCalendarUrl() {
    if (!calendarToken) return null;
    const host = window.location.host;
    return `webcal://${host}/api/calendar/feed?token=${calendarToken}`;
  }

  async function copyCalendarLink() {
    const url = getCalendarUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCalendarCopied(true);
    setTimeout(() => setCalendarCopied(false), 2000);
  }

  function openCalendar() {
    const url = getCalendarUrl();
    if (url) window.location.href = url;
  }

  async function connect() {
    setConnecting(true);
    setConnectErr(null);
    try {
      const res = await fetch("/api/terra/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ athlete_id: "" }), // server uses RAFN_ATHLETE_ID
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setConnectErr(data.error || "Failed to start connection. Check Terra env vars.");
        setConnecting(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setConnectErr("Network error. Try again.");
      setConnecting(false);
    }
  }

  async function disconnect(terraUserId: string) {
    setDisconnecting(terraUserId);
    await fetch("/api/terra/connections", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ terra_user_id: terraUserId }),
    });
    await fetchConnections();
    setDisconnecting(null);
    setBanner("Device disconnected.");
  }

  function formatDate(iso: string | null) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function formatRelative(iso: string | null) {
    if (!iso) return "Never";
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return "Just now";
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  }

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* Top nav */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
          <a href="/dashboard" style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.08em", color: T.accent, textDecoration: "none" }}>
            360 HEILSA
          </a>
          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
            Settings
          </span>
        </div>
        <a href="/dashboard" style={{ fontSize: "11px", color: T.muted, textDecoration: "none", fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.06em" }}>
          ← BACK TO DASHBOARD
        </a>
      </div>

      {/* Banner */}
      {banner && (
        <div style={{
          background: T.green + "18", border: `1px solid ${T.green}40`,
          padding: "10px 24px", fontSize: "13px", color: T.green,
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          ✓ {banner}
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 24px", maxWidth: "640px", width: "100%" }}>

        {/* ── Wearable connections ── */}
        <div style={{ marginBottom: "32px" }}>
          <Label>Wearable Connections</Label>
          <Card>
            <CardHeader
              title="Connected Devices"
              subtitle="Health data syncs automatically every morning via Terra."
            />
            <div style={{ padding: "16px 20px" }}>

              {/* Existing connections */}
              {loadingConns ? (
                <p style={{ fontSize: "13px", color: T.muted, padding: "8px 0" }}>Loading…</p>
              ) : connections.length > 0 ? (
                <div style={{ marginBottom: "16px" }}>
                  {connections.map(c => {
                    const meta = PROVIDER_META[c.provider] || { icon: "📡", label: c.provider || "Unknown" };
                    return (
                      <div key={c.id} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "12px 0", borderBottom: `1px solid ${T.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <span style={{ fontSize: "1.6rem" }}>{meta.icon}</span>
                          <div>
                            <div style={{ fontSize: "14px", fontWeight: 600 }}>{meta.label}</div>
                            <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
                              Connected {formatDate(c.connected_at)} · Last sync: {formatRelative(c.last_sync)}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: T.green + "22", color: T.green, fontWeight: 600 }}>
                            Active
                          </span>
                          <button
                            onClick={() => disconnect(c.terra_user_id)}
                            disabled={disconnecting === c.terra_user_id}
                            style={{
                              background: "none", border: `1px solid ${T.border}`, borderRadius: "6px",
                              color: T.muted, cursor: "pointer", fontSize: "11px",
                              padding: "4px 10px", opacity: disconnecting === c.terra_user_id ? 0.5 : 1,
                            }}
                          >
                            {disconnecting === c.terra_user_id ? "…" : "Disconnect"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ padding: "12px 0 16px", fontSize: "13px", color: T.muted }}>
                  No devices connected yet.
                </div>
              )}

              {/* Connect button */}
              {connectErr && (
                <div style={{
                  background: "rgba(248,81,73,0.08)", border: `1px solid ${T.red}40`,
                  borderRadius: "8px", padding: "10px 14px", marginBottom: "12px",
                  fontSize: "12px", color: T.red,
                }}>
                  {connectErr}
                </div>
              )}
              <button
                onClick={connect}
                disabled={connecting}
                style={{
                  background: T.accentDim, border: `1px solid ${T.accent}`,
                  borderRadius: "10px", color: T.accent, cursor: connecting ? "default" : "pointer",
                  fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                  letterSpacing: "0.08em", padding: "10px 24px",
                  opacity: connecting ? 0.6 : 1,
                }}
              >
                {connecting ? "OPENING…" : connections.length > 0 ? "+ CONNECT ANOTHER DEVICE" : "+ CONNECT YOUR DEVICE"}
              </button>

              <p style={{ fontSize: "11px", color: T.muted, marginTop: "10px", lineHeight: 1.5 }}>
                Supported: Garmin · Whoop · Oura · Ultrahuman · Polar · Apple Health · Fitbit · Withings · Google Fit
              </p>
            </div>
          </Card>
        </div>

        {/* ── Training calendar ── */}
        {calendarToken && (
          <div style={{ marginBottom: "32px" }}>
            <Label>Training Calendar</Label>
            <Card>
              <CardHeader
                title="Calendar Sync"
                subtitle="Your training schedule, always up to date."
              />
              <div style={{ padding: "16px 20px" }}>
                <p style={{ fontSize: "13px", color: T.muted, marginBottom: "16px", lineHeight: 1.5 }}>
                  Tap the button below to subscribe to your training calendar. Sessions auto-appear and stay in sync — no manual updates needed.
                </p>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  <button
                    onClick={openCalendar}
                    style={{
                      background: T.accentDim, border: `1px solid ${T.accent}`,
                      borderRadius: "10px", color: T.accent, cursor: "pointer",
                      fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                      letterSpacing: "0.08em", padding: "10px 24px",
                    }}
                  >
                    SUBSCRIBE TO CALENDAR
                  </button>
                  <button
                    onClick={copyCalendarLink}
                    style={{
                      background: "none", border: `1px solid ${T.border}`,
                      borderRadius: "10px", color: calendarCopied ? T.green : T.muted,
                      cursor: "pointer", fontSize: "11px",
                      fontWeight: 600, letterSpacing: "0.06em", padding: "10px 16px",
                    }}
                  >
                    {calendarCopied ? "✓ COPIED" : "COPY LINK"}
                  </button>
                </div>
                <p style={{ fontSize: "11px", color: T.muted, marginTop: "10px", lineHeight: 1.5 }}>
                  Works with Apple Calendar · Google Calendar · Outlook · any ICS-compatible app
                </p>
              </div>
            </Card>
          </div>
        )}

        {/* ── How it works ── */}
        <div style={{ marginBottom: "32px" }}>
          <Label>How health data works</Label>
          <Card>
            <div style={{ padding: "16px 20px" }}>
              {[
                ["01", "Connect once", "OAuth via Terra — we never see your wearable password."],
                ["02", "Automatic morning sync", "HRV, sleep, resting HR synced every morning after your device uploads."],
                ["03", "Coach sees readiness", "Your coach sees today's readiness score, HRV trend, sleep quality, and RHR before planning your session."],
                ["04", "Load adjusts automatically", "The AI coach compares today's HRV to your 30-day baseline and suggests load adjustments."],
              ].map(([num, title, desc]) => (
                <div key={num} style={{ display: "flex", gap: "16px", marginBottom: "16px" }}>
                  <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", color: T.accent, lineHeight: 1, flexShrink: 0, width: "28px" }}>{num}</div>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "2px" }}>{title}</div>
                    <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.5 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsContent />
    </Suspense>
  );
}
