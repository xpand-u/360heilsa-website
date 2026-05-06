"use client";
import { useEffect, useState, useRef } from "react";

const SESSION_ICONS: Record<string, string> = {
  lifting: "🏋️", jits: "🥋", run: "🏃", hike: "🥾", rest: "💤", other: "📋",
};

const READINESS_COLORS: Record<string, string> = {
  green: "#3fb950", yellow: "#d29922", red: "#f85149", unknown: "#8b949e",
};

const READINESS_LABELS: Record<string, string> = {
  green: "Grænt", yellow: "Gult", red: "Rautt", unknown: "Óþekkt",
};

type Tab = "overview" | "running" | "assessment";

export default function DashboardClient() {
  const [state, setState] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [logInput, setLogInput] = useState("");
  const [logEntries, setLogEntries] = useState<any[]>([]);
  const [doneModal, setDoneModal] = useState(false);
  const [doneNotes, setDoneNotes] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/dashboard/state")
      .then((r) => r.json())
      .then((d) => {
        setState(d);
        setLogEntries(d.scratch?.entries || []);
      });
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  async function addLog() {
    if (!logInput.trim()) return;
    const note = logInput.trim();
    setLogInput("");
    const res = await fetch("/api/dashboard/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    const data = await res.json();
    if (data.ok) setLogEntries(data.entries);
  }

  async function markDone() {
    await fetch("/api/dashboard/mark-done", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: doneNotes, sessionDate: state?.session?.planned_date }),
    });
    setDoneModal(false);
    setDoneNotes("");
    window.location.reload();
  }

  async function sendChat() {
    if (!chatInput.trim() || chatStreaming) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatStreaming(true);

    let aiMsg = "";
    setChatMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        aiMsg += decoder.decode(value);
        setChatMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: aiMsg };
          return updated;
        });
      }
    } catch {
      setChatMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: "Villa — reyndu aftur." };
        return updated;
      });
    } finally {
      setChatStreaming(false);
    }
  }

  if (!state) {
    return (
      <div style={{ background: "#0d1117", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#8b949e", fontFamily: "sans-serif" }}>Hleður...</p>
      </div>
    );
  }

  const { session, week, weekSessions, health, block, limitations, insights } = state;
  const readiness = health?.readiness_call || "unknown";
  const readinessColor = READINESS_COLORS[readiness];
  const shoulder = limitations?.find((l: any) => l.limitation_type === "shoulder");

  return (
    <div style={{ background: "#0d1117", minHeight: "100vh", color: "#e6edf3", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", paddingBottom: "80px" }}>

      {/* Header */}
      <div style={{ background: "#161b22", borderBottom: "1px solid #21262d", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: "17px", fontWeight: 700 }}>360 Heilsa Coach</div>
          <div style={{ fontSize: "12px", color: "#8b949e", marginTop: "2px" }}>
            {block ? `${block.name} · Vika ${block.week} af ${block.planned_weeks}` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "12px", color: "#8b949e", textTransform: "capitalize" }}>{state.todayStr}</div>
          <div style={{ display: "flex", gap: "12px", marginTop: "4px", justifyContent: "flex-end" }}>
            <button onClick={() => window.location.reload()} style={{ background: "none", border: "none", color: "#58a6ff", fontSize: "12px", cursor: "pointer" }}>↻ Uppfæra</button>
            <a href="/" style={{ color: "#8b949e", fontSize: "12px", textDecoration: "none" }}>← Vefsíða</a>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 24px" }}>

        {/* Readiness Banner */}
        <div style={{
          borderRadius: "10px", padding: "16px 24px", display: "flex", alignItems: "center",
          gap: "24px", flexWrap: "wrap" as const, marginTop: "20px",
          border: `1px solid ${readinessColor}40`,
          background: `${readinessColor}10`,
        }}>
          <div style={{
            padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 700,
            letterSpacing: ".7px", textTransform: "uppercase" as const,
            background: `${readinessColor}30`, color: readinessColor,
          }}>
            {READINESS_LABELS[readiness]}
          </div>
          <div style={{ display: "flex", gap: "24px", flex: 1, flexWrap: "wrap" as const }}>
            {[
              [health?.hrv_sdnn, "HRV (ms)"],
              [health?.sleep_total_h, "Svefn (h)"],
              [health?.ultrahuman_score, "Recovery"],
              [health?.resting_hr, "RHR (bpm)"],
            ].map(([val, lbl]) => (
              <div key={String(lbl)}>
                <div style={{ fontSize: "20px", fontWeight: 700, color: val ? "#e6edf3" : "#8b949e" }}>{val ?? "—"}</div>
                <div style={{ fontSize: "10px", color: "#8b949e", marginTop: "3px", textTransform: "uppercase" as const, letterSpacing: ".5px" }}>{lbl as string}</div>
              </div>
            ))}
          </div>
          {health?.notes && (
            <div style={{ fontSize: "12px", color: "#8b949e", fontStyle: "italic", flex: 2 }}>{health.notes}</div>
          )}
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: "4px", marginTop: "20px", borderBottom: "1px solid #21262d" }}>
          {(["overview", "running", "assessment"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: "none", border: "none", borderBottom: tab === t ? "2px solid #58a6ff" : "2px solid transparent",
                color: tab === t ? "#e6edf3" : "#8b949e", cursor: "pointer", fontSize: "13px",
                fontWeight: 600, padding: "8px 18px 10px", marginBottom: "-1px",
              }}
            >
              {t === "overview" ? "Overview" : t === "running" ? "🏃 Running" : "📋 Assessment"}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div style={{ paddingTop: "16px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px", marginTop: "8px" }}>

              {/* Session card */}
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".7px", color: "#8b949e" }}>Næsta Æfing</div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {session?.metadata?.shoulder_risk && (
                      <span style={{
                        fontSize: "10px", padding: "2px 8px", borderRadius: "999px", fontWeight: 600,
                        background: session.metadata.shoulder_risk === "high" ? "rgba(248,81,73,.12)" : session.metadata.shoulder_risk === "moderate" ? "rgba(210,153,34,.12)" : "rgba(63,185,80,.12)",
                        color: session.metadata.shoulder_risk === "high" ? "#f85149" : session.metadata.shoulder_risk === "moderate" ? "#d29922" : "#3fb950",
                      }}>
                        {session.metadata.shoulder_risk === "moderate" ? "⚠️ Öxl: Moderate" : session.metadata.shoulder_risk === "high" ? "🔴 Öxl: High" : "🫀 Öxl: Low"}
                      </span>
                    )}
                    {session?.planned_date && (
                      <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", fontWeight: 600, background: "rgba(88,166,255,.12)", color: "#58a6ff" }}>
                        {session.planned_date}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  {session ? (
                    <>
                      <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>
                        {SESSION_ICONS[session.session_type] || "📋"} {session.session_label}
                      </div>
                      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" as const, marginBottom: "14px" }}>
                        {session.metadata?.duration_target && <div style={{ fontSize: "12px", color: "#8b949e" }}>⏱ <span style={{ color: "#e6edf3" }}>{session.metadata.duration_target}</span></div>}
                        {session.metadata?.location && <div style={{ fontSize: "12px", color: "#8b949e" }}>📍 <span style={{ color: "#e6edf3" }}>{session.metadata.location}</span></div>}
                        {session.metadata?.expected_rpe && <div style={{ fontSize: "12px", color: "#8b949e" }}>💪 <span style={{ color: "#e6edf3" }}>RPE {session.metadata.expected_rpe}</span></div>}
                      </div>

                      <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".7px", color: "#8b949e", margin: "12px 0 6px" }}>Æfingaplan</div>
                      <div style={{
                        background: "#0d1117", border: "1px solid #21262d", borderRadius: "7px",
                        padding: "12px 14px", fontSize: "12px", lineHeight: 1.7, color: "#e6edf3",
                        whiteSpace: "pre-wrap", maxHeight: "240px", overflowY: "auto",
                        fontFamily: "monospace",
                      }}>
                        {session.content_md || "Engin áætlun — keyrðu sync script."}
                      </div>

                      {/* Log widget */}
                      <div style={{ marginTop: "16px", borderTop: "1px solid #21262d", paddingTop: "14px" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".06em", color: "#8b949e", marginBottom: "10px" }}>
                          Dagbók æfingar
                        </div>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <input
                            value={logInput}
                            onChange={(e) => setLogInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && addLog()}
                            placeholder="RDL 4×6 @ 85kg — fannst sterk…"
                            style={{
                              flex: 1, background: "#1c2333", border: "1px solid #21262d",
                              borderRadius: "8px", color: "#e6edf3", fontSize: "13px",
                              padding: "8px 12px", outline: "none", fontFamily: "inherit",
                            }}
                          />
                          <button onClick={addLog} style={{
                            background: "#58a6ff", border: "none", borderRadius: "8px",
                            color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                            padding: "8px 16px",
                          }}>Skrá</button>
                        </div>
                        {logEntries.length > 0 && (
                          <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                            {[...logEntries].reverse().map((e: any, i) => (
                              <div key={i} style={{ display: "flex", gap: "8px", fontSize: "12px" }}>
                                <span style={{ color: "#58a6ff", fontWeight: 600, minWidth: "36px" }}>{e.time}</span>
                                <span style={{ color: "#8b949e" }}>{e.note}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => setDoneModal(true)}
                          style={{
                            marginTop: "12px", background: "transparent", border: "1px solid #21262d",
                            borderRadius: "8px", color: "#8b949e", cursor: "pointer", fontSize: "12px",
                            fontWeight: 600, padding: "7px 14px", fontFamily: "inherit",
                          }}
                        >
                          ✓ Merkja æfingu lokið
                        </button>
                      </div>
                    </>
                  ) : (
                    <p style={{ color: "#8b949e" }}>Engin æfing. Keyrðu sync script.</p>
                  )}
                </div>
              </div>

              {/* Week tracker */}
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".7px", color: "#8b949e" }}>Þessi Vika</div>
                  {week?.kids_week && (
                    <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(188,140,255,.12)", color: "#bc8cff" }}>Barnsvika</span>
                  )}
                </div>
                <div style={{ padding: "10px 18px" }}>
                  {weekSessions.map((s: any) => {
                    const isToday = s.scheduled_date === state.today;
                    const isDone = s.status === "completed";
                    const isMissed = s.status === "missed";
                    return (
                      <div key={s.id} style={{
                        display: "flex", alignItems: "center", gap: "10px", padding: "9px 0",
                        borderBottom: "1px solid #21262d", opacity: isMissed ? 0.4 : 1,
                        borderLeft: isToday ? "2px solid #58a6ff" : "2px solid transparent",
                        paddingLeft: isToday ? "8px" : undefined,
                      }}>
                        <div style={{ fontSize: "14px", width: "22px", textAlign: "center" as const }}>
                          {SESSION_ICONS[s.session_type] || "📋"}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "10px", color: "#8b949e", textTransform: "uppercase" as const, letterSpacing: ".3px" }}>
                            {s.scheduled_date?.slice(5).replace("-", "/")}
                            {isToday ? " · Í dag" : ""}
                          </div>
                          <div style={{ fontSize: "12px", color: isToday ? "#58a6ff" : "#e6edf3", fontWeight: isToday ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                            {s.label}
                          </div>
                        </div>
                        <div style={{
                          width: "18px", height: "18px", borderRadius: "50%", display: "flex",
                          alignItems: "center", justifyContent: "center", fontSize: "10px", flexShrink: 0,
                          background: isDone ? "#3fb950" : isMissed ? "#f85149" : "transparent",
                          border: !isDone && !isMissed ? (isToday ? "2px solid #58a6ff" : "2px solid #21262d") : "none",
                          color: isDone ? "#000" : isMissed ? "#fff" : "transparent",
                          fontWeight: 700,
                        }}>
                          {isDone ? "✓" : isMissed ? "✗" : ""}
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#8b949e", paddingTop: "10px", borderTop: "1px solid #21262d", marginTop: "4px" }}>
                    <span>{week?.sessions_completed ?? 0} / {week?.sessions_planned ?? weekSessions.length} lokið</span>
                    <span>{(week?.sessions_planned ?? weekSessions.length) - (week?.sessions_completed ?? 0)} eftir</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Block + Shoulder */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginTop: "16px" }}>

              {/* Block */}
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".7px", color: "#8b949e" }}>Þjálfunarblokk</div>
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(88,166,255,.12)", color: "#58a6ff", fontWeight: 600 }}>Active</span>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  {block ? (
                    <>
                      <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "10px" }}>{block.name}</div>
                      <div style={{ fontSize: "11px", color: "#8b949e", display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <span>Vika {block.week} af {block.planned_weeks}</span>
                        <span>{Math.min(100, Math.round((block.week / block.planned_weeks) * 100))}%</span>
                      </div>
                      <div style={{ background: "#21262d", borderRadius: "999px", height: "5px", overflow: "hidden", marginBottom: "12px" }}>
                        <div style={{ height: "100%", borderRadius: "999px", background: "#58a6ff", width: `${Math.min(100, Math.round((block.week / block.planned_weeks) * 100))}%` }} />
                      </div>
                      {[["Byrjaði", block.started_at], ["Deload", `${block.deload_due}${block.deloadDays != null ? ` (${block.deloadDays}d)` : ""}`]].map(([l, v]) => (
                        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "5px 0", borderBottom: "1px solid #21262d" }}>
                          <span style={{ color: "#8b949e" }}>{l}</span>
                          <span>{v}</span>
                        </div>
                      ))}
                    </>
                  ) : <p style={{ color: "#8b949e" }}>Engin virk blokk.</p>}
                </div>
              </div>

              {/* Shoulder */}
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid #21262d", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".7px", color: "#8b949e" }}>Öxl</div>
                  <span style={{ fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "rgba(210,153,34,.12)", color: "#d29922", fontWeight: 600 }}>
                    {shoulder?.status || "Monitoring"}
                  </span>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  {shoulder ? (
                    <>
                      <div style={{ fontSize: "15px", fontWeight: 600, marginBottom: "10px" }}>
                        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#d29922", display: "inline-block", marginRight: "8px" }} />
                        {shoulder.status}
                      </div>
                      <div style={{ fontSize: "12px", color: "#8b949e", marginBottom: "8px" }}>{shoulder.description}</div>
                      {shoulder.escalation_deadline && (
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "5px 0", borderBottom: "1px solid #21262d" }}>
                          <span style={{ color: "#8b949e" }}>Physio deadline</span>
                          <span>{shoulder.escalation_deadline}</span>
                        </div>
                      )}
                    </>
                  ) : <p style={{ color: "#8b949e", fontSize: "13px" }}>Engar takmarkanir skráðar.</p>}
                </div>
              </div>

              {/* Health Stats */}
              <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: "1px solid #21262d" }}>
                  <div style={{ fontSize: "10px", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".7px", color: "#8b949e" }}>Heilsugögn — 30 dagar</div>
                </div>
                <div style={{ padding: "16px 18px" }}>
                  {[
                    ["Meðalsvefn — 7d", insights.sleep7d ? `${insights.sleep7d}h` : "—"],
                    ["Meðalsvefn — 30d", insights.sleep30d ? `${insights.sleep30d}h` : "—"],
                    ["HRV meðaltal — 30d", insights.avgHrv30d ? `${insights.avgHrv30d}ms` : "—"],
                    ["RHR meðaltal — 30d", insights.avgRhr30d ? `${insights.avgRhr30d}bpm` : "—"],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", padding: "5px 0", borderBottom: "1px solid #21262d" }}>
                      <span style={{ color: "#8b949e" }}>{l}</span>
                      <span style={{ color: v === "—" ? "#8b949e" : "#e6edf3" }}>{v}</span>
                    </div>
                  ))}
                  {insights.sleep7d === 0 && (
                    <p style={{ fontSize: "11px", color: "#8b949e", marginTop: "10px", fontStyle: "italic" }}>
                      Tengdu Health Auto Export til að sjá gögn hér.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── RUNNING TAB ── */}
        {tab === "running" && (
          <div style={{ paddingTop: "24px" }}>
            <div style={{ background: "#161b22", border: "1px dashed #21262d", borderRadius: "10px", padding: "40px 32px", textAlign: "center" as const, color: "#8b949e" }}>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#e6edf3", marginBottom: "8px" }}>Strava gögn ekki tiltæk</div>
              <p style={{ fontSize: "13px", lineHeight: 1.6 }}>
                Keyrðu <code style={{ color: "#58a6ff" }}>python3 automation/strava-sync.py</code> til að sækja Strava æfingar.
                Þegar gögn eru til staðar birtast hér ACWR, svæðagreining, vikukm og aerobic efficiency.
              </p>
            </div>
          </div>
        )}

        {/* ── ASSESSMENT TAB ── */}
        {tab === "assessment" && (
          <div style={{ paddingTop: "24px" }}>
            <div style={{ background: "#161b22", border: "1px dashed #21262d", borderRadius: "10px", padding: "40px 32px", textAlign: "center" as const, color: "#8b949e" }}>
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#e6edf3", marginBottom: "8px" }}>Líkamsstöðumat — Í bið</div>
              <p style={{ fontSize: "13px", lineHeight: 1.6 }}>
                16 prófa sjálfmatsferli yfir kyrrstæða líkamsstöðu, hreyfigæði, virkni og öndun.
                Sjá <code style={{ color: "#58a6ff" }}>coaching-library/POSTURAL-SCREENING-PROTOCOL.md</code>.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── CHAT WIDGET ── */}
      <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 100, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px" }}>

        {chatOpen && (
          <div style={{
            width: "380px", background: "#161b22", border: "1px solid #21262d",
            borderRadius: "12px", overflow: "hidden",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #21262d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 700 }}>360 Heilsa Coach</div>
                <div style={{ fontSize: "11px", color: "#8b949e" }}>Spurðu um æfinguna eða skráðu líðan</div>
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: "#8b949e", cursor: "pointer", fontSize: "18px" }}>✕</button>
            </div>

            <div style={{ height: "300px", overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {chatMessages.length === 0 && (
                <p style={{ color: "#8b949e", fontSize: "12px", fontStyle: "italic", textAlign: "center", marginTop: "40px" }}>
                  Spyrðu um æfinguna, biðdu um leiðréttingar eða skráðu hvernig þér líður.
                </p>
              )}
              {chatMessages.map((m, i) => (
                <div key={i} style={{
                  padding: "8px 12px", borderRadius: "8px", fontSize: "13px", lineHeight: 1.6,
                  background: m.role === "user" ? "#1c2333" : "#0d1117",
                  color: m.role === "user" ? "#e6edf3" : "#c9d1d9",
                  border: "1px solid #21262d",
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content || (chatStreaming && i === chatMessages.length - 1 ? "▌" : "")}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid #21262d", display: "flex", gap: "8px" }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder="Hvernig er líðanin? Breyta æfingu..."
                disabled={chatStreaming}
                style={{
                  flex: 1, background: "#1c2333", border: "1px solid #21262d",
                  borderRadius: "8px", color: "#e6edf3", fontSize: "13px",
                  padding: "8px 12px", outline: "none", fontFamily: "inherit",
                }}
              />
              <button
                onClick={sendChat}
                disabled={chatStreaming || !chatInput.trim()}
                style={{
                  background: "#58a6ff", border: "none", borderRadius: "8px",
                  color: "#fff", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                  padding: "8px 14px", opacity: chatStreaming ? 0.6 : 1,
                }}
              >
                →
              </button>
            </div>
          </div>
        )}

        <button
          onClick={() => setChatOpen(!chatOpen)}
          style={{
            width: "52px", height: "52px", borderRadius: "50%",
            background: "#58a6ff", border: "none", cursor: "pointer",
            fontSize: "22px", display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(88,166,255,0.4)",
          }}
        >
          {chatOpen ? "✕" : "💬"}
        </button>
      </div>

      {/* Mark Done Modal */}
      {doneModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && setDoneModal(false)}
        >
          <div style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: "12px", padding: "24px", width: "420px", maxWidth: "90vw" }}>
            <div style={{ fontSize: "16px", fontWeight: 700, marginBottom: "6px" }}>Merkja æfingu lokið</div>
            <p style={{ fontSize: "13px", color: "#8b949e", marginBottom: "16px" }}>Stuttar athugasemdir? (valfrjálst)</p>
            <textarea
              value={doneNotes}
              onChange={(e) => setDoneNotes(e.target.value)}
              placeholder="Líðan, þungi, öxl…"
              rows={3}
              style={{
                width: "100%", background: "#1c2333", border: "1px solid #21262d",
                borderRadius: "8px", color: "#e6edf3", fontFamily: "inherit",
                fontSize: "13px", padding: "10px 12px", resize: "vertical" as const, outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: "8px", marginTop: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setDoneModal(false)} style={{ background: "transparent", border: "1px solid #21262d", borderRadius: "8px", color: "#8b949e", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", padding: "9px 16px" }}>Hætta við</button>
              <button onClick={markDone} style={{ background: "#3fb950", border: "none", borderRadius: "8px", color: "#000", cursor: "pointer", fontFamily: "inherit", fontSize: "13px", fontWeight: 700, padding: "9px 20px" }}>Merkja lokið</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
