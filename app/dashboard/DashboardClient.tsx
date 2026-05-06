"use client";
import { useEffect, useState, useRef, useCallback } from "react";

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:        "#0c0c0b",
  surface:   "#141413",
  surface2:  "#1a1a18",
  border:    "#222220",
  border2:   "#2a2a28",
  text:      "#f0ede8",
  muted:     "#6b6860",
  accent:    "#c8a96e",
  accentDim: "rgba(200,169,110,0.12)",
  green:     "#3fb950",
  yellow:    "#d29922",
  red:       "#f85149",
  blue:      "#58a6ff",
};

const READINESS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  green:   { color: T.green,  bg: "rgba(63,185,80,0.08)",   label: "Green"   },
  yellow:  { color: T.yellow, bg: "rgba(210,153,34,0.08)",  label: "Yellow"  },
  red:     { color: T.red,    bg: "rgba(248,81,73,0.08)",   label: "Red"     },
  unknown: { color: T.muted,  bg: "transparent",            label: "Unknown" },
};

const SESSION_ICONS: Record<string, string> = {
  lifting: "🏋️", jits: "🥋", run: "🏃", hike: "🥾", rest: "💤", other: "📋",
};

type NavItem = "today" | "week" | "history";

// ─── Tiny components ──────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "6px" }}>
      {children}
    </p>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "12px", overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function CardHeader({ left, right }: { left: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>{left}</div>
      {right && <div>{right}</div>}
    </div>
  );
}

function Badge({ children, color = T.blue }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", fontWeight: 600, background: color + "22", color }}>
      {children}
    </span>
  );
}

function StatPill({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "22px", fontWeight: 700, fontFamily: "'BebasNeue', sans-serif", color: color || T.text, letterSpacing: "0.04em" }}>
        {value}
      </div>
      <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ values, color = T.accent, width = 72, height = 28 }: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return null;
  const valid = values.filter(v => v != null && !isNaN(v));
  if (valid.length < 2) return null;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const pts = valid.map((v, i) => {
    const x = (i / (valid.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const lastX = width;
  const lastY = height - ((valid[valid.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ overflow: "visible", display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity={0.7} />
      <circle cx={lastX} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [data, setData]               = useState<any>(null);
  const [nav, setNav]                 = useState<NavItem>("today");
  const [logInput, setLogInput]       = useState("");
  const [logEntries, setLogEntries]   = useState<any[]>([]);
  const [doneModal, setDoneModal]     = useState(false);
  const [doneNotes, setDoneNotes]     = useState("");
  const [chatMsgs, setChatMsgs]       = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [streaming, setStreaming]     = useState(false);
  const [chatOpen, setChatOpen]       = useState(true);
  const [isMobile, setIsMobile]       = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [brief, setBrief]             = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [readinessModal, setReadinessModal] = useState(false);
  const [manualForm, setManualForm]   = useState({ readiness_call: "green", hrv_sdnn: "", sleep_total_h: "", resting_hr: "", notes: "" });
  const [manualSaving, setManualSaving] = useState(false);
  const chatEndRef  = useRef<HTMLDivElement>(null);
  const logInputRef = useRef<HTMLInputElement>(null);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    const d = await fetch("/api/dashboard/state").then(r => r.json());
    setData(d);
    setLogEntries(d.scratch?.entries || []);
    setLastRefreshed(new Date());
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchData();
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [fetchData]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  async function addLog() {
    const note = logInput.trim();
    if (!note) return;
    setLogInput("");
    const res = await fetch("/api/dashboard/log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const d = await res.json();
    if (d.ok) setLogEntries(d.entries);
  }

  async function markDone() {
    await fetch("/api/dashboard/mark-done", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: doneNotes, sessionDate: data?.session?.planned_date }),
    });
    setDoneModal(false);
    setDoneNotes("");
    fetchData();
  }

  async function generateBrief() {
    setBrief("");
    setBriefLoading(true);
    try {
      const res = await fetch("/api/dashboard/morning-brief", { method: "POST" });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        setBrief(buf);
      }
    } catch {
      setBrief("Error generating brief. Try again.");
    } finally {
      setBriefLoading(false);
    }
  }

  async function saveManualReadiness() {
    setManualSaving(true);
    await fetch("/api/health/manual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(manualForm),
    });
    setManualSaving(false);
    setReadinessModal(false);
    setManualForm({ readiness_call: "green", hrv_sdnn: "", sleep_total_h: "", resting_hr: "", notes: "" });
    fetchData();
  }

  async function sendChat(overrideMsg?: string) {
    const msg = (overrideMsg || chatInput).trim();
    if (!msg || streaming) return;
    setChatInput("");
    setChatMsgs(p => [...p, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setStreaming(true);
    let buf = "";
    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        setChatMsgs(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: buf }; return u; });
      }
    } catch {
      setChatMsgs(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: "Error. Try again." }; return u; });
    } finally {
      setStreaming(false);
      if (buf.toLowerCase().includes("logged") || buf.toLowerCase().includes("marked")) {
        fetchData();
      }
    }
  }

  if (!data) return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.muted, fontFamily: "sans-serif", letterSpacing: "0.1em", fontSize: "12px" }}>LOADING…</p>
    </div>
  );

  const { session, week, weekSessions, health, block, limitations, insights, healthDate, today } = data;
  const readiness     = health?.readiness_call || "unknown";
  const rc            = READINESS_CONFIG[readiness] || READINESS_CONFIG.unknown;
  const shoulder      = limitations?.find((l: any) => l.limitation_type === "shoulder");
  const blockWeekPct  = block ? Math.min(100, Math.round((block.week / block.planned_weeks) * 100)) : 0;
  const healthIsStale = healthDate && healthDate !== today;

  const healthHistory: any[] = data.healthHistory || [];
  const hrvValues   = healthHistory.map((r: any) => r.hrv_sdnn).filter(Boolean);
  const sleepValues = healthHistory.map((r: any) => r.sleep_total_h).filter(Boolean);
  const rhrValues   = healthHistory.map((r: any) => r.resting_hr).filter(Boolean);

  // ── Chat panel ───────────────────────────────────────────────────────────────
  const ChatPanel = (
    <div style={{
      width: isMobile ? "100%" : "360px",
      flexShrink: 0,
      borderLeft: isMobile ? "none" : `1px solid ${T.border}`,
      borderTop: isMobile ? `1px solid ${T.border}` : "none",
      background: T.surface,
      display: "flex",
      flexDirection: "column",
      height: isMobile ? "420px" : "auto",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.08em", color: T.accent }}>
            360 HEILSA COACH
          </div>
          <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
            Ask about today's session · Adjust load · Log notes
          </div>
        </div>
        {isMobile && (
          <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "18px", padding: "4px 8px" }}>×</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {chatMsgs.length === 0 && (
          <div style={{ marginTop: "16px" }}>
            <p style={{ color: T.muted, fontSize: "12px", textAlign: "center", marginBottom: "16px" }}>
              How can I help you today?
            </p>
            {[
              "How are you feeling today?",
              "What are the key focuses for this session?",
              "Should I reduce the load?",
              "Log that I finished my warm-up",
            ].map(q => (
              <button key={q} onClick={() => sendChat(q)} style={{
                display: "block", width: "100%", textAlign: "left",
                background: T.surface2, border: `1px solid ${T.border}`,
                borderRadius: "8px", color: T.muted, cursor: "pointer",
                fontSize: "12px", padding: "9px 12px", marginBottom: "7px",
                fontFamily: "inherit",
              }}>{q}</button>
            ))}
          </div>
        )}
        {chatMsgs.map((m, i) => (
          <div key={i} style={{
            padding: "10px 14px", borderRadius: "10px", fontSize: "13px", lineHeight: 1.65,
            background: m.role === "user" ? T.accentDim : T.surface2,
            border: `1px solid ${m.role === "user" ? T.accent + "33" : T.border}`,
            color: T.text, whiteSpace: "pre-wrap",
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "92%",
          }}>
            {m.content || (streaming && i === chatMsgs.length - 1 ? "▌" : "")}
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
            placeholder="Type here…"
            disabled={streaming}
            style={{
              flex: 1, background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: "8px", color: T.text, fontSize: "13px",
              padding: "9px 12px", outline: "none", fontFamily: "inherit",
            }}
          />
          <button onClick={() => sendChat()} disabled={streaming || !chatInput.trim()} style={{
            background: T.accent, border: "none", borderRadius: "8px",
            color: T.bg, cursor: "pointer", fontWeight: 700,
            padding: "9px 14px", fontFamily: "'BebasNeue', sans-serif",
            letterSpacing: "0.06em", fontSize: "0.85rem",
            opacity: streaming ? 0.5 : 1,
          }}>→</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── TOP NAV ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "52px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "12px" : "28px" }}>
          <span style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.08em", color: T.accent }}>
            360 HEILSA
          </span>
          <div style={{ display: "flex", gap: "2px" }}>
            {([["today", "TODAY"], ["week", "WEEK"], ["history", "HISTORY"]] as [NavItem, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setNav(id)} style={{
                border: "none", cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                fontSize: isMobile ? "0.75rem" : "0.9rem", letterSpacing: "0.08em",
                padding: isMobile ? "4px 8px" : "4px 14px", borderRadius: "6px",
                color: nav === id ? T.accent : T.muted,
                background: nav === id ? T.accentDim : "transparent",
              } as any}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {!isMobile && lastRefreshed && (
            <span style={{ fontSize: "10px", color: T.muted }}>
              {lastRefreshed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          <button onClick={fetchData} disabled={refreshing} style={{
            background: "none", border: `1px solid ${T.border}`, borderRadius: "6px",
            color: refreshing ? T.accent : T.muted, cursor: "pointer",
            fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em",
            padding: "4px 10px", fontFamily: "'BebasNeue', sans-serif",
          }}>
            {refreshing ? "..." : "↻"}
          </button>
          {!isMobile && (
            <span style={{ fontSize: "12px", color: T.muted, textTransform: "capitalize" }}>{data.todayStr}</span>
          )}
          <button onClick={() => setChatOpen(o => !o)} style={{
            background: chatOpen ? T.accentDim : "none",
            border: `1px solid ${chatOpen ? T.accent : T.border}`,
            borderRadius: "6px", color: chatOpen ? T.accent : T.muted,
            cursor: "pointer", fontSize: "11px", fontWeight: 600,
            letterSpacing: "0.06em", padding: "4px 10px",
            fontFamily: "'BebasNeue', sans-serif",
          }}>
            {chatOpen ? (isMobile ? "×" : "CLOSE") : "COACH"}
          </button>
          <a href="/dashboard/settings" style={{
            fontSize: "11px", color: T.muted, textDecoration: "none",
            fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.06em",
            padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: "6px",
          }}>⚙</a>
          {!isMobile && (
            <a href="/" style={{ fontSize: "11px", color: T.muted, textDecoration: "none" }}>← WEBSITE</a>
          )}
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px" : "20px 24px" }}>

          {/* READINESS HERO */}
          <div style={{
            borderRadius: "14px", padding: isMobile ? "16px" : "20px 28px", marginBottom: "16px",
            border: `1px solid ${rc.color}40`, background: rc.bg,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap", marginBottom: (hrvValues.length > 1 || sleepValues.length > 1) ? "16px" : "0" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <Label>Today&apos;s Readiness</Label>
                  {healthIsStale && (
                    <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: T.yellow + "22", color: T.yellow, letterSpacing: "0.06em", marginBottom: "6px" }}>
                      {healthDate}
                    </span>
                  )}
                  <button onClick={() => setReadinessModal(true)} style={{
                    background: "none", border: `1px solid ${T.border}`, borderRadius: "4px",
                    color: T.muted, cursor: "pointer", fontSize: "9px", padding: "1px 7px",
                    fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.08em", marginBottom: "6px",
                  }}>+ LOG</button>
                </div>
                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: isMobile ? "2.4rem" : "3rem", letterSpacing: "0.06em", color: rc.color, lineHeight: 1 }}>
                  {rc.label.toUpperCase()}
                </div>
              </div>

              <div style={{ width: "1px", height: "48px", background: T.border2, flexShrink: 0 }} />

              <div style={{ display: "flex", gap: isMobile ? "20px" : "32px", flexWrap: "wrap" }}>
                <StatPill label="HRV (ms)"   value={health?.hrv_sdnn       ?? "—"} color={health?.hrv_sdnn       ? T.text : T.muted} />
                <StatPill label="Sleep (h)"  value={health?.sleep_total_h  ?? "—"} color={health?.sleep_total_h  ? T.text : T.muted} />
                <StatPill label="Recovery"   value={health?.ultrahuman_score ?? "—"} color={health?.ultrahuman_score ? T.accent : T.muted} />
                <StatPill label="RHR (bpm)"  value={health?.resting_hr     ?? "—"} color={health?.resting_hr     ? T.text : T.muted} />
              </div>

              {health?.notes && health.notes !== "Vault initialized. No data yet. Update this tomorrow morning." && (
                <>
                  <div style={{ width: "1px", height: "36px", background: T.border2, flexShrink: 0 }} />
                  <p style={{ fontSize: "13px", color: T.muted, fontStyle: "italic", flex: 1 }}>{health.notes}</p>
                </>
              )}
            </div>

            {/* Sparklines */}
            {(hrvValues.length > 1 || sleepValues.length > 1) && (
              <div style={{ display: "flex", gap: "24px", flexWrap: "wrap", paddingTop: "14px", borderTop: `1px solid ${rc.color}20` }}>
                {hrvValues.length > 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      HRV 30d
                      {insights?.avgHrv30d ? <span style={{ color: T.text, marginLeft: "6px" }}>{insights.avgHrv30d}ms avg</span> : null}
                    </div>
                    <Sparkline values={hrvValues} color={rc.color} width={isMobile ? 80 : 100} />
                  </div>
                )}
                {sleepValues.length > 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Sleep 30d
                      {insights?.sleep7d ? <span style={{ color: T.text, marginLeft: "6px" }}>{insights.sleep7d}h avg (7d)</span> : null}
                    </div>
                    <Sparkline values={sleepValues} color={T.blue} width={isMobile ? 80 : 100} />
                  </div>
                )}
                {rhrValues.length > 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      RHR 30d
                      {insights?.avgRhr30d ? <span style={{ color: T.text, marginLeft: "6px" }}>{insights.avgRhr30d}bpm avg</span> : null}
                    </div>
                    <Sparkline values={rhrValues} color={T.yellow} width={isMobile ? 80 : 100} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* MORNING BRIEF */}
          {nav === "today" && (
            <div style={{ marginBottom: "16px" }}>
              {!brief && !briefLoading && (
                <button onClick={generateBrief} style={{
                  background: T.accentDim, border: `1px solid ${T.accent}33`,
                  borderRadius: "10px", color: T.accent, cursor: "pointer",
                  fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em",
                  padding: "10px 20px", fontFamily: "'BebasNeue', sans-serif",
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                  ☀ GENERATE MORNING BRIEF
                </button>
              )}
              {(brief || briefLoading) && (
                <Card>
                  <CardHeader
                    left="Morning Brief"
                    right={
                      brief && !briefLoading ? (
                        <button onClick={generateBrief} style={{
                          background: "none", border: `1px solid ${T.border}`, borderRadius: "6px",
                          color: T.muted, cursor: "pointer", fontSize: "10px", padding: "2px 8px",
                        }}>↺ Regenerate</button>
                      ) : undefined
                    }
                  />
                  <div style={{ padding: "16px 20px", fontSize: "13px", lineHeight: 1.75, color: T.text, whiteSpace: "pre-wrap" }}>
                    {briefLoading && !brief ? <span style={{ color: T.muted }}>▌</span> : brief}
                    {briefLoading && brief && <span style={{ color: T.muted }}>▌</span>}
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* TODAY VIEW */}
          {nav === "today" && (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 300px", gap: "14px" }}>

              {/* Session card */}
              <Card>
                <CardHeader
                  left="Next Session"
                  right={
                    <div style={{ display: "flex", gap: "6px" }}>
                      {session?.metadata?.shoulder_risk && session.metadata.shoulder_risk !== "low" && (
                        <Badge color={session.metadata.shoulder_risk === "high" ? T.red : T.yellow}>
                          {session.metadata.shoulder_risk === "high" ? "🔴 Shoulder: High" : "⚠️ Shoulder: Mid"}
                        </Badge>
                      )}
                      {session?.planned_date && <Badge color={T.muted}>{session.planned_date}</Badge>}
                    </div>
                  }
                />
                <div style={{ padding: "20px 20px 0" }}>
                  {session ? (
                    <>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                        <span style={{ fontSize: "2rem" }}>{SESSION_ICONS[session.session_type] || "📋"}</span>
                        <div>
                          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", lineHeight: 1.1 }}>
                            {session.session_label}
                          </div>
                          <div style={{ display: "flex", gap: "14px", marginTop: "6px", flexWrap: "wrap" }}>
                            {[
                              ["⏱", session.metadata?.duration_target],
                              ["📍", session.metadata?.location],
                              ["💪", session.metadata?.expected_rpe ? `RPE ${session.metadata.expected_rpe}` : null],
                            ].filter(([, v]) => v).map(([icon, val]) => (
                              <span key={String(val)} style={{ fontSize: "12px", color: T.muted }}>
                                {icon} <span style={{ color: T.text }}>{val}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div style={{ marginBottom: "0" }}>
                        <Label>Training Plan</Label>
                        <div style={{
                          background: T.bg, border: `1px solid ${T.border}`, borderRadius: "8px",
                          padding: "14px 16px", fontSize: "12px", lineHeight: 1.8, color: T.text,
                          whiteSpace: "pre-wrap", maxHeight: "260px", overflowY: "auto",
                          fontFamily: "ui-monospace, 'SF Mono', monospace",
                        }}>
                          {session.content_md || "No plan — run sync script."}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: T.muted, padding: "12px 0" }}>No session scheduled. Run sync script.</p>
                  )}
                </div>

                {/* Log widget */}
                <div style={{ padding: "16px 20px", borderTop: `1px solid ${T.border}`, marginTop: "16px" }}>
                  <Label>Session Log</Label>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    <input
                      ref={logInputRef}
                      value={logInput}
                      onChange={e => setLogInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addLog()}
                      placeholder="RDL 4×6 @ 85kg — felt strong…"
                      style={{
                        flex: 1, background: T.surface2, border: `1px solid ${T.border}`,
                        borderRadius: "8px", color: T.text, fontSize: "13px",
                        padding: "8px 12px", outline: "none", fontFamily: "inherit",
                      }}
                    />
                    <button onClick={addLog} style={{
                      background: T.accent, border: "none", borderRadius: "8px",
                      color: T.bg, cursor: "pointer", fontSize: "12px", fontWeight: 700,
                      padding: "8px 16px", fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.06em",
                    }}>LOG</button>
                  </div>
                  {logEntries.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginBottom: "10px" }}>
                      {[...logEntries].reverse().map((e: any, i) => (
                        <div key={i} style={{ display: "flex", gap: "10px", fontSize: "12px" }}>
                          <span style={{ color: T.accent, fontWeight: 600, minWidth: "36px", fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.04em" }}>{e.time}</span>
                          <span style={{ color: T.muted }}>{e.note}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setDoneModal(true)} style={{
                    background: "transparent", border: `1px solid ${T.border}`,
                    borderRadius: "8px", color: T.muted, cursor: "pointer",
                    fontSize: "11px", fontWeight: 700, padding: "7px 14px",
                    fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.08em",
                  }}>
                    ✓ MARK SESSION DONE
                  </button>
                </div>
              </Card>

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Week strip */}
                <Card>
                  <CardHeader left="This Week" right={week?.kids_week ? <Badge color="#bc8cff">Kids Week</Badge> : undefined} />
                  <div style={{ padding: "8px 16px 12px" }}>
                    {weekSessions.map((s: any) => {
                      const isToday  = s.scheduled_date === today;
                      const isDone   = s.status === "completed";
                      const isMissed = s.status === "missed";
                      return (
                        <div key={s.id} style={{
                          display: "flex", alignItems: "center", gap: "10px",
                          padding: "8px 0", borderBottom: `1px solid ${T.border}`,
                          opacity: isMissed ? 0.4 : 1,
                        }}>
                          <span style={{ fontSize: "13px", width: "20px", textAlign: "center", flexShrink: 0 }}>
                            {SESSION_ICONS[s.session_type] || "📋"}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                              {s.scheduled_date?.slice(5).replace("-", "/")}
                              {isToday ? " · TODAY" : ""}
                            </div>
                            <div style={{
                              fontSize: "12px", color: isToday ? T.accent : T.text,
                              fontWeight: isToday ? 600 : 400,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {s.label}
                            </div>
                          </div>
                          <div style={{
                            width: "16px", height: "16px", borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: "9px", fontWeight: 700, flexShrink: 0,
                            background: isDone ? T.green : isMissed ? T.red : "transparent",
                            border: !isDone && !isMissed ? `1.5px solid ${isToday ? T.accent : T.border}` : "none",
                            color: isDone ? "#000" : "#fff",
                          }}>
                            {isDone ? "✓" : isMissed ? "✗" : ""}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: T.muted, paddingTop: "8px" }}>
                      <span>{week?.sessions_completed ?? 0} / {week?.sessions_planned ?? weekSessions.length} done</span>
                      <span>{(week?.sessions_planned ?? weekSessions.length) - (week?.sessions_completed ?? 0)} remaining</span>
                    </div>
                  </div>
                </Card>

                {/* Block */}
                <Card>
                  <CardHeader left="Training Block" right={<Badge color={T.accent}>Active</Badge>} />
                  <div style={{ padding: "14px 16px" }}>
                    {block ? (
                      <>
                        <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.3rem", letterSpacing: "0.04em", marginBottom: "8px" }}>
                          {block.name}
                        </div>
                        <div style={{ fontSize: "11px", color: T.muted, display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span>Week {block.week} of {block.planned_weeks}</span>
                          <span style={{ color: T.accent }}>{blockWeekPct}%</span>
                        </div>
                        <div style={{ background: T.border, borderRadius: "999px", height: "3px", overflow: "hidden", marginBottom: "12px" }}>
                          <div style={{ height: "100%", background: T.accent, width: `${blockWeekPct}%`, borderRadius: "999px" }} />
                        </div>
                        {[
                          ["Started", block.started_at],
                          ["Deload", block.deload_due ? `${block.deload_due}${block.deloadDays != null ? ` (${block.deloadDays}d)` : ""}` : "—"],
                        ].map(([l, v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
                            <span style={{ color: T.muted }}>{l}</span>
                            <span style={{ color: block.deloadDays != null && block.deloadDays <= 7 && l === "Deload" ? T.yellow : T.text }}>{v}</span>
                          </div>
                        ))}
                      </>
                    ) : <p style={{ color: T.muted, fontSize: "13px" }}>No active block.</p>}
                  </div>
                </Card>

                {/* Shoulder */}
                {shoulder && (
                  <Card>
                    <CardHeader left="Shoulder" right={
                      <Badge color={shoulder.status === "monitoring" ? T.yellow : shoulder.status === "resolved" ? T.green : T.muted}>
                        {shoulder.status}
                      </Badge>
                    } />
                    <div style={{ padding: "14px 16px" }}>
                      <p style={{ fontSize: "12px", color: T.muted, lineHeight: 1.6, marginBottom: "8px" }}>{shoulder.description}</p>
                      {shoulder.escalation_deadline && (
                        <div style={{ fontSize: "11px", color: T.yellow, padding: "6px 10px", background: "rgba(210,153,34,0.08)", borderRadius: "6px" }}>
                          Physio deadline: {shoulder.escalation_deadline}
                        </div>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {nav === "week" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "12px" }}>
              {weekSessions.map((s: any) => {
                const isToday = s.scheduled_date === today;
                const isDone  = s.status === "completed";
                return (
                  <Card key={s.id} style={{ border: isToday ? `1px solid ${T.accent}` : undefined }}>
                    <div style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <div>
                          <div style={{ fontSize: "10px", color: isToday ? T.accent : T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
                            {s.scheduled_date}{isToday ? " · TODAY" : ""}
                          </div>
                          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.04em" }}>
                            {SESSION_ICONS[s.session_type]} {s.label}
                          </div>
                        </div>
                        <Badge color={isDone ? T.green : isToday ? T.accent : T.muted}>
                          {isDone ? "Done" : isToday ? "Today" : "Scheduled"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {/* HISTORY VIEW */}
          {nav === "history" && (
            <Card>
              <CardHeader left="Recent Sessions" />
              <div style={{ padding: "16px" }}>
                {data.recentLogs?.length > 0 ? data.recentLogs.map((log: any) => (
                  <div key={log.id} style={{ padding: "12px 0", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.04em", marginBottom: "4px" }}>
                        {SESSION_ICONS[log.session_type]} {log.label}
                      </div>
                      {log.notes && <p style={{ fontSize: "12px", color: T.muted }}>{log.notes}</p>}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: "11px", color: T.muted }}>{log.log_date}</div>
                      {log.rpe_overall && <div style={{ fontSize: "11px", color: T.accent, marginTop: "2px" }}>RPE {log.rpe_overall}</div>}
                    </div>
                  </div>
                )) : (
                  <p style={{ color: T.muted, fontSize: "13px", fontStyle: "italic" }}>No sessions logged yet.</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* ── CHAT PANEL (desktop sidebar) ── */}
        {chatOpen && !isMobile && ChatPanel}
      </div>

      {/* ── MOBILE CHAT (bottom panel) ── */}
      {chatOpen && isMobile && (
        <div style={{ flexShrink: 0 }}>{ChatPanel}</div>
      )}

      {/* ── MANUAL READINESS MODAL ── */}
      {readinessModal && (
        <div onClick={e => e.target === e.currentTarget && setReadinessModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "28px", width: "400px", maxWidth: "100%" }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", marginBottom: "4px" }}>TODAY&apos;S READINESS</div>
            <p style={{ fontSize: "13px", color: T.muted, marginBottom: "20px" }}>Log your morning check-in manually</p>

            <div style={{ marginBottom: "14px" }}>
              <Label>Readiness</Label>
              <div style={{ display: "flex", gap: "8px" }}>
                {(["green", "yellow", "red"] as const).map(r => {
                  const colors = { green: T.green, yellow: T.yellow, red: T.red };
                  const labels = { green: "Green", yellow: "Yellow", red: "Red" };
                  const active = manualForm.readiness_call === r;
                  return (
                    <button key={r} onClick={() => setManualForm(f => ({ ...f, readiness_call: r }))} style={{
                      flex: 1, padding: "8px", borderRadius: "8px", cursor: "pointer",
                      fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.06em",
                      background: active ? colors[r] + "22" : T.surface2,
                      border: `1px solid ${active ? colors[r] : T.border}`,
                      color: active ? colors[r] : T.muted,
                    }}>{labels[r]}</button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "14px" }}>
              {[
                ["HRV (ms)", "hrv_sdnn", "45"],
                ["Sleep (h)", "sleep_total_h", "7.5"],
                ["RHR (bpm)", "resting_hr", "52"],
              ].map(([label, key, placeholder]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <input
                    type="number"
                    value={(manualForm as any)[key]}
                    onChange={e => setManualForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={placeholder}
                    style={{
                      width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
                      borderRadius: "8px", color: T.text, fontSize: "14px",
                      padding: "8px 10px", outline: "none", fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ marginBottom: "18px" }}>
              <Label>Notes</Label>
              <input
                value={manualForm.notes}
                onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Disrupted sleep, feeling heavy, stress…"
                style={{
                  width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
                  borderRadius: "8px", color: T.text, fontSize: "13px",
                  padding: "8px 12px", outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setReadinessModal(false)} style={{
                background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px",
                color: T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", padding: "9px 16px",
              }}>Cancel</button>
              <button onClick={saveManualReadiness} disabled={manualSaving} style={{
                background: T.accent, border: "none", borderRadius: "8px",
                color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                fontSize: "1rem", fontWeight: 700, padding: "9px 24px", letterSpacing: "0.06em",
                opacity: manualSaving ? 0.6 : 1,
              }}>SAVE</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK DONE MODAL ── */}
      {doneModal && (
        <div onClick={e => e.target === e.currentTarget && setDoneModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "28px", width: "420px", maxWidth: "100%" }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", marginBottom: "6px" }}>MARK DONE</div>
            <p style={{ fontSize: "13px", color: T.muted, marginBottom: "16px" }}>Any notes? (optional)</p>
            <textarea
              value={doneNotes}
              onChange={e => setDoneNotes(e.target.value)}
              placeholder="How it went, load, shoulder, anything…"
              rows={3}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.text, fontFamily: "inherit", fontSize: "13px", padding: "10px 12px", resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "14px", justifyContent: "flex-end" }}>
              <button onClick={() => setDoneModal(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", padding: "9px 16px" }}>
                Cancel
              </button>
              <button onClick={markDone} style={{ background: T.accent, border: "none", borderRadius: "8px", color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", fontWeight: 700, padding: "9px 24px", letterSpacing: "0.06em" }}>
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
