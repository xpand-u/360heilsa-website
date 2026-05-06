"use client";
import { useEffect, useState, useRef } from "react";

// ─── Design tokens (hybrid: website brand + dashboard utility) ───────────────
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

const READINESS_CONFIG: Record<string, { color: string; bg: string; label: string; labelIs: string }> = {
  green:   { color: T.green,  bg: "rgba(63,185,80,0.08)",   label: "Green",   labelIs: "Grænt" },
  yellow:  { color: T.yellow, bg: "rgba(210,153,34,0.08)",  label: "Yellow",  labelIs: "Gult" },
  red:     { color: T.red,    bg: "rgba(248,81,73,0.08)",   label: "Red",     labelIs: "Rautt" },
  unknown: { color: T.muted,  bg: "transparent",            label: "Unknown", labelIs: "Óþekkt" },
};

const SESSION_ICONS: Record<string, string> = {
  lifting: "🏋️", jits: "🥋", run: "🏃", hike: "🥾", rest: "💤", other: "📋",
};

type NavItem = "today" | "week" | "history";

// ─── Tiny components ─────────────────────────────────────────────────────────

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
    <span style={{
      fontSize: "10px", padding: "2px 8px", borderRadius: "999px", fontWeight: 600,
      background: color + "22", color,
    }}>{children}</span>
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const [data, setData] = useState<any>(null);
  const [nav, setNav] = useState<NavItem>("today");
  const [logInput, setLogInput] = useState("");
  const [logEntries, setLogEntries] = useState<any[]>([]);
  const [doneModal, setDoneModal] = useState(false);
  const [doneNotes, setDoneNotes] = useState("");
  const [chatMsgs, setChatMsgs] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const logInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/dashboard/state").then(r => r.json()).then(d => {
      setData(d);
      setLogEntries(d.scratch?.entries || []);
    });
  }, []);

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
    window.location.reload();
  }

  async function sendChat() {
    const msg = chatInput.trim();
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
      setChatMsgs(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: "Villa. Reyndu aftur." }; return u; });
    } finally { setStreaming(false); }
  }

  if (!data) return (
    <div style={{ background: T.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: T.muted, fontFamily: "sans-serif", letterSpacing: "0.1em", fontSize: "12px" }}>HLEÐUR…</p>
    </div>
  );

  const { session, week, weekSessions, health, block, limitations, insights, healthDate, today } = data;
  const readiness = health?.readiness_call || "unknown";
  const healthIsStale = healthDate && healthDate !== today;
  const rc = READINESS_CONFIG[readiness];
  const shoulder = limitations?.find((l: any) => l.limitation_type === "shoulder");

  const blockWeekPct = block ? Math.min(100, Math.round((block.week / block.planned_weeks) * 100)) : 0;

  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", display: "flex", flexDirection: "column" }}>

      {/* ── TOP NAV ── */}
      <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "52px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
          <span style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.08em", color: T.accent }}>
            360 HEILSA
          </span>
          <div style={{ display: "flex", gap: "4px" }}>
            {([["today", "Í DAG"], ["week", "VIKAN"], ["history", "SAGA"]] as [NavItem, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setNav(id)} style={{
                border: "none", cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                fontSize: "0.9rem", letterSpacing: "0.08em", padding: "4px 14px", borderRadius: "6px",
                color: nav === id ? T.accent : T.muted,
                background: nav === id ? T.accentDim : "transparent",
              } as any}>{label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "12px", color: T.muted, textTransform: "capitalize" }}>{data.todayStr}</span>
          <button onClick={() => setChatOpen(o => !o)} style={{
            background: chatOpen ? T.accentDim : "none", border: `1px solid ${chatOpen ? T.accent : T.border}`,
            borderRadius: "6px", color: chatOpen ? T.accent : T.muted, cursor: "pointer",
            fontSize: "11px", fontWeight: 600, letterSpacing: "0.08em", padding: "5px 12px",
          }}>
            {chatOpen ? "LOKA COACH" : "OPNA COACH"}
          </button>
          <a href="/" style={{ fontSize: "11px", color: T.muted, textDecoration: "none" }}>← VEFSÍÐA</a>
        </div>
      </div>

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>

          {/* READINESS HERO */}
          <div style={{
            borderRadius: "14px", padding: "20px 28px", marginBottom: "20px",
            border: `1px solid ${rc.color}40`, background: rc.bg,
            display: "flex", alignItems: "center", gap: "32px", flexWrap: "wrap",
          }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
                  Líðan í dag
                </p>
                {healthIsStale && (
                  <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: T.yellow + "22", color: T.yellow, letterSpacing: "0.06em" }}>
                    {healthDate}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "3rem", letterSpacing: "0.06em", color: rc.color, lineHeight: 1 }}>
                {rc.labelIs.toUpperCase()}
              </div>
            </div>
            <div style={{ width: "1px", height: "48px", background: T.border2, flexShrink: 0 }} />
            <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
              <StatPill label="HRV (ms)" value={health?.hrv_sdnn ?? "—"} color={health?.hrv_sdnn ? T.text : T.muted} />
              <StatPill label="Svefn (h)" value={health?.sleep_total_h ?? "—"} color={health?.sleep_total_h ? T.text : T.muted} />
              <StatPill label="Recovery" value={health?.ultrahuman_score ?? "—"} color={health?.ultrahuman_score ? T.accent : T.muted} />
              <StatPill label="RHR (bpm)" value={health?.resting_hr ?? "—"} color={health?.resting_hr ? T.text : T.muted} />
            </div>
            {(insights?.avgHrv30d || insights?.sleep7d) && (
              <>
                <div style={{ width: "1px", height: "48px", background: T.border2, flexShrink: 0 }} />
                <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
                  {insights.avgHrv30d > 0 && (
                    <StatPill label="HRV avg 30d" value={insights.avgHrv30d} color={T.muted} />
                  )}
                  {insights.sleep7d > 0 && (
                    <StatPill label="Svefn avg 7d" value={insights.sleep7d + "h"} color={T.muted} />
                  )}
                  {insights.sleep30d > 0 && (
                    <StatPill label="Svefn avg 30d" value={insights.sleep30d + "h"} color={T.muted} />
                  )}
                </div>
              </>
            )}
            {health?.notes && health.notes !== "Vault initialized. No data yet. Update this tomorrow morning." && (
              <>
                <div style={{ width: "1px", height: "48px", background: T.border2 }} />
                <p style={{ fontSize: "13px", color: T.muted, fontStyle: "italic", flex: 1 }}>{health.notes}</p>
              </>
            )}
          </div>

          {/* TODAY VIEW */}
          {nav === "today" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px" }}>

              {/* Session card */}
              <Card>
                <CardHeader
                  left="Næsta Æfing"
                  right={
                    <div style={{ display: "flex", gap: "6px" }}>
                      {session?.metadata?.shoulder_risk && session.metadata.shoulder_risk !== "low" && (
                        <Badge color={session.metadata.shoulder_risk === "high" ? T.red : T.yellow}>
                          {session.metadata.shoulder_risk === "high" ? "🔴 Öxl: Há áhætta" : "⚠️ Öxl: Moderate"}
                        </Badge>
                      )}
                      {session?.planned_date && <Badge color={T.muted}>{session.planned_date}</Badge>}
                    </div>
                  }
                />
                <div style={{ padding: "20px 20px 0" }}>
                  {session ? (
                    <>
                      {/* Session title */}
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: "16px" }}>
                        <span style={{ fontSize: "2rem" }}>{SESSION_ICONS[session.session_type] || "📋"}</span>
                        <div>
                          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", lineHeight: 1.1 }}>
                            {session.session_label}
                          </div>
                          <div style={{ display: "flex", gap: "16px", marginTop: "6px", flexWrap: "wrap" }}>
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

                      {/* Plan */}
                      <div style={{ marginBottom: "0" }}>
                        <Label>Æfingaplan</Label>
                        <div style={{
                          background: T.bg, border: `1px solid ${T.border}`, borderRadius: "8px",
                          padding: "14px 16px", fontSize: "12px", lineHeight: 1.8, color: T.text,
                          whiteSpace: "pre-wrap", maxHeight: "260px", overflowY: "auto",
                          fontFamily: "ui-monospace, 'SF Mono', monospace",
                        }}>
                          {session.content_md || "Engin áætlun — keyrðu sync script."}
                        </div>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: T.muted, padding: "12px 0" }}>Engin æfing skráð. Keyrðu sync script.</p>
                  )}
                </div>

                {/* Log widget */}
                <div style={{ padding: "16px 20px", borderTop: `1px solid ${T.border}`, marginTop: "16px" }}>
                  <Label>Dagbók æfingar</Label>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    <input
                      ref={logInputRef}
                      value={logInput}
                      onChange={e => setLogInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addLog()}
                      placeholder="RDL 4×6 @ 85kg — líðan góð…"
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
                    }}>SKRÁ</button>
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
                    transition: "border-color 0.2s, color 0.2s",
                  }}>
                    ✓ MERKJA ÆFINGU LOKIÐ
                  </button>
                </div>
              </Card>

              {/* Right column */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

                {/* Week strip */}
                <Card>
                  <CardHeader left="Þessi Vika" right={week?.kids_week ? <Badge color="#bc8cff">Barnsvika</Badge> : undefined} />
                  <div style={{ padding: "8px 16px 12px" }}>
                    {weekSessions.map((s: any) => {
                      const isToday = s.scheduled_date === today;
                      const isDone = s.status === "completed";
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
                              {isToday ? " · Í DAG" : ""}
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
                      <span>{week?.sessions_completed ?? 0} / {week?.sessions_planned ?? weekSessions.length} lokið</span>
                      <span>{(week?.sessions_planned ?? weekSessions.length) - (week?.sessions_completed ?? 0)} eftir</span>
                    </div>
                  </div>
                </Card>

                {/* Block */}
                <Card>
                  <CardHeader left="Þjálfunarblokk" right={<Badge color={T.accent}>Virkt</Badge>} />
                  <div style={{ padding: "14px 16px" }}>
                    {block ? (
                      <>
                        <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.04em", marginBottom: "8px" }}>
                          {block.name}
                        </div>
                        <div style={{ fontSize: "11px", color: T.muted, display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span>Vika {block.week} af {block.planned_weeks}</span>
                          <span style={{ color: T.accent }}>{blockWeekPct}%</span>
                        </div>
                        <div style={{ background: T.border, borderRadius: "999px", height: "3px", overflow: "hidden", marginBottom: "12px" }}>
                          <div style={{ height: "100%", background: T.accent, width: `${blockWeekPct}%`, borderRadius: "999px" }} />
                        </div>
                        {[
                          ["Byrjaði", block.started_at],
                          ["Deload", block.deload_due ? `${block.deload_due}${block.deloadDays != null ? ` (${block.deloadDays}d)` : ""}` : "—"],
                        ].map(([l, v]) => (
                          <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", padding: "4px 0", borderBottom: `1px solid ${T.border}` }}>
                            <span style={{ color: T.muted }}>{l}</span>
                            <span style={{ color: block.deloadDays != null && block.deloadDays <= 7 && l === "Deload" ? T.yellow : T.text }}>{v}</span>
                          </div>
                        ))}
                      </>
                    ) : <p style={{ color: T.muted, fontSize: "13px" }}>Engin virk blokk.</p>}
                  </div>
                </Card>

                {/* Shoulder */}
                {shoulder && (
                  <Card>
                    <CardHeader left="Öxl" right={
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "12px" }}>
              {weekSessions.map((s: any) => {
                const isToday = s.scheduled_date === today;
                const isDone = s.status === "completed";
                return (
                  <Card key={s.id} style={{ border: isToday ? `1px solid ${T.accent}` : undefined }}>
                    <div style={{ padding: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                        <div>
                          <div style={{ fontSize: "10px", color: isToday ? T.accent : T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "4px" }}>
                            {s.scheduled_date}{isToday ? " · Í DAG" : ""}
                          </div>
                          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.04em" }}>
                            {SESSION_ICONS[s.session_type]} {s.label}
                          </div>
                        </div>
                        <Badge color={isDone ? T.green : isToday ? T.accent : T.muted}>
                          {isDone ? "Lokið" : isToday ? "Í dag" : "Áætlað"}
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
              <CardHeader left="Nýlegar æfingar" />
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
                  <p style={{ color: T.muted, fontSize: "13px", fontStyle: "italic" }}>Engar æfingar skráðar ennþá.</p>
                )}
              </div>
            </Card>
          )}
        </div>

        {/* ── AI CHAT PANEL ── */}
        {chatOpen && (
          <div style={{
            width: "360px", flexShrink: 0, borderLeft: `1px solid ${T.border}`,
            background: T.surface, display: "flex", flexDirection: "column",
          }}>
            {/* Chat header */}
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.08em", color: T.accent }}>
                360 HEILSA COACH
              </div>
              <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
                Spurðu um æfinguna · Biðdu um leiðréttingar · Skráðu líðan
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {chatMsgs.length === 0 && (
                <div style={{ marginTop: "24px" }}>
                  <p style={{ color: T.muted, fontSize: "12px", textAlign: "center", marginBottom: "20px" }}>
                    Hvernig get ég hjálpað þér í dag?
                  </p>
                  {[
                    "Hvernig líður þér í dag?",
                    "Hverjar eru áherslurnar í æfingunni?",
                    "Á ég að létta á þungan?",
                  ].map(q => (
                    <button key={q} onClick={() => { setChatInput(q); }} style={{
                      display: "block", width: "100%", textAlign: "left",
                      background: T.surface2, border: `1px solid ${T.border}`,
                      borderRadius: "8px", color: T.muted, cursor: "pointer",
                      fontSize: "12px", padding: "10px 12px", marginBottom: "8px",
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

            {/* Chat input */}
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="Skrifaðu hér…"
                  disabled={streaming}
                  style={{
                    flex: 1, background: T.surface2, border: `1px solid ${T.border}`,
                    borderRadius: "8px", color: T.text, fontSize: "13px",
                    padding: "9px 12px", outline: "none", fontFamily: "inherit",
                  }}
                />
                <button onClick={sendChat} disabled={streaming || !chatInput.trim()} style={{
                  background: T.accent, border: "none", borderRadius: "8px",
                  color: T.bg, cursor: "pointer", fontWeight: 700,
                  padding: "9px 14px", fontFamily: "'BebasNeue', sans-serif",
                  letterSpacing: "0.06em", fontSize: "0.85rem",
                  opacity: streaming ? 0.5 : 1,
                }}>→</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── MARK DONE MODAL ── */}
      {doneModal && (
        <div onClick={e => e.target === e.currentTarget && setDoneModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "28px", width: "420px", maxWidth: "90vw" }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", marginBottom: "6px" }}>MERKJA LOKIÐ</div>
            <p style={{ fontSize: "13px", color: T.muted, marginBottom: "16px" }}>Stuttar athugasemdir? (valfrjálst)</p>
            <textarea value={doneNotes} onChange={e => setDoneNotes(e.target.value)}
              placeholder="Líðan, þungi, öxl, annað…" rows={3}
              style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.text, fontFamily: "inherit", fontSize: "13px", padding: "10px 12px", resize: "vertical", outline: "none" }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "14px", justifyContent: "flex-end" }}>
              <button onClick={() => setDoneModal(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", padding: "9px 16px" }}>
                Hætta við
              </button>
              <button onClick={markDone} style={{ background: T.accent, border: "none", borderRadius: "8px", color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", fontWeight: 700, padding: "9px 24px", letterSpacing: "0.06em" }}>
                STAÐFESTA
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
