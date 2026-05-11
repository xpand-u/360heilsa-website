"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatWeight, weightLabel, weightInputToKg, type UnitSystem } from "@/lib/units";

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

type NavItem = "today" | "week" | "history" | "running" | "assessment" | "nutrition" | "program";

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

// ─── Session plan renderer ────────────────────────────────────────────────────

function SessionPlanRenderer({ content, onExerciseTap }: { content: string; onExerciseTap: (name: string) => void }) {
  const lines = content.split("\n");
  return (
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: "4px" }} />;
        // Section header: "A. Strength" / "B. Accessory" / "#..."
        if (/^[A-Z]\.\s/.test(line) || /^#{1,3}\s/.test(line)) {
          return (
            <div key={i} style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: "10px", fontWeight: 700, color: T.accent,
              letterSpacing: "0.1em", textTransform: "uppercase",
              marginTop: "12px", marginBottom: "3px",
            }}>
              {line.replace(/^#{1,3}\s*/, "")}
            </div>
          );
        }
        // Coaching cue — italic (*cue*)
        if (line.startsWith("*") && !line.startsWith("**")) {
          return (
            <div key={i} style={{ color: T.muted, fontStyle: "italic", fontSize: "11px", paddingLeft: "8px", marginBottom: "2px" }}>
              {line.replace(/^\*+|\*+$/g, "")}
            </div>
          );
        }
        // Exercise line — contains em-dash, en-dash, or spaced hyphen separator
        const hasDash = line.includes("—") || line.includes("–") || / - /.test(line);
        if (hasDash && !line.startsWith("#") && !line.startsWith("*")) {
          const dashMatch = line.match(/—|–| - /);
          const dashIdx   = dashMatch ? line.indexOf(dashMatch[0]) : -1;
          const exerciseName = line.slice(0, dashIdx).trim();
          const rest       = line.slice(dashIdx);
          return (
            <div key={i} style={{ display: "flex", alignItems: "baseline", gap: "3px", marginBottom: "1px", flexWrap: "wrap" }}>
              <button
                onClick={() => onExerciseTap(exerciseName)}
                title="Tap to see tutorial"
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: T.text, fontFamily: "ui-monospace, 'SF Mono', monospace",
                  fontSize: "12px", padding: "0", textAlign: "left", fontWeight: 500,
                  textDecoration: "underline", textDecorationColor: T.accent + "55",
                  textUnderlineOffset: "2px",
                }}
              >
                {exerciseName}
              </button>
              <span style={{ color: T.muted, fontSize: "12px", fontFamily: "ui-monospace, 'SF Mono', monospace" }}>{rest}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ color: T.text, fontSize: "12px", fontFamily: "ui-monospace, 'SF Mono', monospace", lineHeight: 1.8 }}>
            {line}
          </div>
        );
      })}
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
  const router = useRouter();
  const [data, setData]               = useState<any>(null);
  const [nav, setNav]                 = useState<NavItem>("today");
  const [logInput, setLogInput]       = useState("");
  const [logEntries, setLogEntries]   = useState<any[]>([]);
  const [doneModal, setDoneModal]     = useState(false);
  const [rescheduleId, setRescheduleId]   = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [doneNotes, setDoneNotes]     = useState("");
  const [doneFeedbackRpe, setDoneFeedbackRpe]         = useState<number | null>(null);
  const [doneFeedbackEnergy, setDoneFeedbackEnergy]   = useState<string | null>(null);
  const [doneFeedbackLiked, setDoneFeedbackLiked]     = useState<Set<string>>(new Set());
  const [doneFeedbackDisliked, setDoneFeedbackDisliked] = useState<Set<string>>(new Set());
  const [chatMsgs, setChatMsgs]       = useState<{ role: string; content: string }[]>([]);
  const [chatInput, setChatInput]     = useState("");
  const [streaming, setStreaming]     = useState(false);
  const [chatOpen, setChatOpen]       = useState(true);
  const [isMobile, setIsMobile]       = useState(false);
  const [refreshing, setRefreshing]   = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [runs, setRuns]               = useState<any[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [assessment, setAssessment]   = useState<any>(null);
  const [assessLoading, setAssessLoading] = useState(false);
  const [nutrition, setNutrition]     = useState<any>(null);
  const [nutritionLoading, setNutritionLoading] = useState(false);

  // Screening workflow
  const [showScreening, setShowScreening]     = useState(false);
  const [screenPhotos, setScreenPhotos]       = useState<Record<string, string>>({});
  const [photoConverting, setPhotoConverting] = useState<string | null>(null);
  const [screenFindings, setScreenFindings]   = useState("");
  const [screenReport, setScreenReport]       = useState("");
  const [screenLoading, setScreenLoading]     = useState(false);
  const [analyzeStep, setAnalyzeStep]         = useState(0);
  const [screenSaving, setScreenSaving]       = useState(false);
  const [screenSaved, setScreenSaved]         = useState(false);
  const [screenSavedId, setScreenSavedId]     = useState<string | null>(null);
  const [showClinical, setShowClinical]       = useState(false);
  // Post-screening discussion
  const [discussMsgs, setDiscussMsgs]         = useState<{role:string; content:string}[]>([]);
  const [discussInput, setDiscussInput]       = useState("");
  const [discussStreaming, setDiscussStreaming] = useState(false);
  const [planLocked, setPlanLocked]           = useState(false);
  // Past assessment expansion
  const [expandedAssessment, setExpandedAssessment] = useState<string | null>(null);
  const [brief, setBrief]             = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [readinessModal, setReadinessModal] = useState(false);
  const [manualForm, setManualForm]   = useState({ readiness_call: "green", hrv_sdnn: "", sleep_total_h: "", resting_hr: "", notes: "" });
  const [manualSaving, setManualSaving] = useState(false);

  // Simplified check-in (non-wearable)
  const [checkinSleep, setCheckinSleep]     = useState<number | null>(null);
  const [checkinEnergy, setCheckinEnergy]   = useState<number | null>(null);
  const [checkinSoreness, setCheckinSoreness] = useState("");
  const [checkinShowAdvanced, setCheckinShowAdvanced] = useState(false);

  // Session logging
  const [sessionLogModal, setSessionLogModal]       = useState(false);
  const [sessionLogType, setSessionLogType]         = useState("lifting");
  const [sessionLogDate, setSessionLogDate]         = useState("");
  const [sessionLogDuration, setSessionLogDuration] = useState("");
  const [sessionLogRpe, setSessionLogRpe]           = useState<number | null>(null);
  const [sessionLogShoulder, setSessionLogShoulder] = useState("no_issues");
  const [sessionLogExercises, setSessionLogExercises] = useState([{ exercise: "", sets: "", reps: "", load_kg: "" }]);
  const [sessionLogNotes, setSessionLogNotes]       = useState("");
  const [sessionLogSaving, setSessionLogSaving]     = useState(false);

  // Foundation Week debrief
  const [foundationReady, setFoundationReady]             = useState(false);
  const [foundationDebrief, setFoundationDebrief]         = useState("");
  const [foundationDebriefLoading, setFoundationDebriefLoading] = useState(false);

  // Program generation
  const [programGenerating, setProgramGenerating]         = useState(false);
  const [programGenerated, setProgramGenerated]           = useState(false);

  // Block debrief
  const [blockDebrief, setBlockDebrief]                   = useState("");
  const [blockDebriefLoading, setBlockDebriefLoading]     = useState(false);

  // Goal pivot modal
  const [pivotModal, setPivotModal]                       = useState(false);
  const [pivotMsgs, setPivotMsgs]                         = useState<{ role: string; content: string }[]>([]);
  const [pivotInput, setPivotInput]                       = useState("");
  const [pivotStreaming, setPivotStreaming]                = useState(false);
  const [pivotReady, setPivotReady]                       = useState(false);
  const [pivotData, setPivotData]                         = useState<{ new_goal: string; context: string } | null>(null);
  const [pivotConfirming, setPivotConfirming]             = useState(false);
  const pivotStarted = useRef(false);
  const pivotEndRef  = useRef<HTMLDivElement>(null);

  // Exercise history (session log)
  const [exHistory, setExHistory]                         = useState<Record<number, { date: string; sets: number | null; reps: string | null; load_kg: number | null }[]>>({});

  // PR notification (shown after session save)
  const [prNotification, setPrNotification]               = useState<{ exercise: string; weight: number; reps: string; previous_best: number }[] | null>(null);

  // Program reveal modal (shown after program generation)
  const [revealModal, setRevealModal]                     = useState(false);
  const [revealMsgs, setRevealMsgs]                       = useState<{ role: string; content: string }[]>([]);
  const [revealInput, setRevealInput]                     = useState("");
  const [revealStreaming, setRevealStreaming]              = useState(false);
  const [revealBlockData, setRevealBlockData]             = useState<any>(null);
  const revealStarted = useRef(false);
  const revealEndRef  = useRef<HTMLDivElement>(null);

  // Exercise tutorial modal
  const [tutorialModal, setTutorialModal]                 = useState<{ name: string; loading: boolean; data?: any } | null>(null);

  // Cycle tracking
  const [cycleLogging, setCycleLogging]                   = useState(false);

  const chatEndRef      = useRef<HTMLDivElement>(null);
  const logInputRef     = useRef<HTMLInputElement>(null);
  const discussInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef   = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch("/api/dashboard/state");
    if (res.status === 401) { router.push("/login"); return; }
    const d = await res.json();
    setData(d);
    setLogEntries(d.scratch?.entries || []);
    setLastRefreshed(new Date());
    setRefreshing(false);
  }, [router]);

  const fetchRuns = useCallback(async () => {
    if (runsLoading) return;
    setRunsLoading(true);
    try {
      const d = await fetch("/api/strava/activities?limit=60").then(r => r.json());
      setRuns(d.activities || []);
    } catch { /* ignore */ } finally {
      setRunsLoading(false);
    }
  }, [runsLoading]);

  useEffect(() => {
    // Onboarding enforcement is handled by middleware (ob cookie).
    // DashboardClient can trust it's only rendered for users who have completed onboarding.

    // Check Foundation Week debrief readiness
    fetch("/api/dashboard/foundation-debrief")
      .then(r => r.json())
      .then(d => { if (d.ready) setFoundationReady(true); });
    fetchData();
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    // Auto-refresh every 60 seconds
    const poll = setInterval(fetchData, 60_000);
    return () => {
      window.removeEventListener("resize", check);
      clearInterval(poll);
    };
  }, [fetchData]);

  useEffect(() => {
    if (nav === "running" && runs.length === 0 && !runsLoading) fetchRuns();
    if (nav === "assessment" && !assessment && !assessLoading) {
      setAssessLoading(true);
      fetch("/api/dashboard/assessment").then(r => r.json())
        .then(d => {
          setAssessment(d);
          // Reload latest saved report so it persists across tab switches
          if (d.latestReport && !screenReport) setScreenReport(d.latestReport);
        })
        .finally(() => setAssessLoading(false));
    }
    if (nav === "nutrition" && !nutrition && !nutritionLoading) {
      setNutritionLoading(true);
      fetch("/api/dashboard/nutrition").then(r => r.json())
        .then(d => setNutrition(d.profile))
        .finally(() => setNutritionLoading(false));
    }
  }, [nav]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  useEffect(() => {
    pivotEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pivotMsgs]);

  useEffect(() => {
    if (pivotModal && !pivotStarted.current) {
      pivotStarted.current = true;
      streamPivot(null);
    }
    if (!pivotModal) {
      pivotStarted.current = false;
    }
  }, [pivotModal]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (revealModal && !revealStarted.current && revealBlockData) {
      revealStarted.current = true;
      streamReveal(null);
    }
    if (!revealModal) revealStarted.current = false;
  }, [revealModal, revealBlockData]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    revealEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [revealMsgs]);

  const ANALYZE_STEPS = [
    "Reviewing lateral views…",
    "Checking shoulder position and symmetry…",
    "Identifying postural patterns…",
    "Assessing hip and pelvic alignment…",
    "Building your implementation plan…",
    "Finalizing assessment…",
  ];
  useEffect(() => {
    if (!screenLoading) { setAnalyzeStep(0); return; }
    const t = setInterval(() => setAnalyzeStep(p => (p + 1) % ANALYZE_STEPS.length), 7000);
    return () => clearInterval(t);
  }, [screenLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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

  async function rescheduleSession() {
    if (!rescheduleId || !rescheduleDate) return;
    await fetch("/api/dashboard/reschedule", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: rescheduleId, newDate: rescheduleDate }),
    });
    setRescheduleId(null);
    setRescheduleDate("");
    mutate();
  }

  async function markDone() {
    const feedback = (doneFeedbackRpe || doneFeedbackEnergy || doneFeedbackLiked.size || doneFeedbackDisliked.size || doneNotes)
      ? {
          rpe: doneFeedbackRpe,
          energy: doneFeedbackEnergy,
          liked: Array.from(doneFeedbackLiked),
          disliked: Array.from(doneFeedbackDisliked),
          notes: doneNotes || null,
        }
      : null;
    await fetch("/api/dashboard/mark-done", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: doneNotes, sessionDate: data?.session?.planned_date, feedback }),
    });
    setDoneModal(false);
    setDoneNotes("");
    setDoneFeedbackRpe(null);
    setDoneFeedbackEnergy(null);
    setDoneFeedbackLiked(new Set());
    setDoneFeedbackDisliked(new Set());
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
    // Auto-determine readiness from energy if set
    const form = checkinEnergy !== null ? {
      ...manualForm,
      sleep_total_h: checkinSleep !== null ? String(checkinSleep) : manualForm.sleep_total_h,
      readiness_call: checkinEnergy >= 7 ? "green" : checkinEnergy >= 5 ? "yellow" : "red",
      notes: [checkinSoreness, manualForm.notes].filter(Boolean).join(" | "),
    } : manualForm;
    await fetch("/api/health/manual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setManualSaving(false);
    setReadinessModal(false);
    setManualForm({ readiness_call: "green", hrv_sdnn: "", sleep_total_h: "", resting_hr: "", notes: "" });
    setCheckinSleep(null); setCheckinEnergy(null); setCheckinSoreness(""); setCheckinShowAdvanced(false);
    fetchData();
  }

  async function saveSessionLog() {
    if (!sessionLogType || !sessionLogRpe) return;
    setSessionLogSaving(true);
    const top_sets = sessionLogExercises
      .filter(e => e.exercise.trim())
      .map(e => ({ exercise: e.exercise, sets: Number(e.sets) || null, reps: e.reps || null, load_kg: weightInputToKg(e.load_kg, unitSystem) ?? null }));
    const res = await fetch("/api/dashboard/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_type: sessionLogType,
        log_date: sessionLogDate || data?.today,
        duration_min: sessionLogDuration ? Number(sessionLogDuration) : null,
        rpe_overall: sessionLogRpe,
        shoulder_status: sessionLogShoulder,
        top_sets: top_sets.length > 0 ? top_sets : null,
        notes: sessionLogNotes || null,
      }),
    });
    const saved = await res.json();
    setSessionLogSaving(false);
    setSessionLogModal(false);
    setSessionLogType("lifting"); setSessionLogDate(""); setSessionLogDuration("");
    setSessionLogRpe(null); setSessionLogShoulder("no_issues");
    setSessionLogExercises([{ exercise: "", sets: "", reps: "", load_kg: "" }]);
    setSessionLogNotes("");
    setExHistory({});
    // Show PR notification if any
    if (saved.prs?.length > 0) {
      setPrNotification(saved.prs);
      setTimeout(() => setPrNotification(null), 9000);
    }
    fetchData();
  }

  async function fetchFoundationDebrief() {
    setFoundationDebriefLoading(true);
    setFoundationDebrief("");
    try {
      const res = await fetch("/api/dashboard/foundation-debrief", { method: "POST" });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        setFoundationDebrief(buf);
      }
    } finally {
      setFoundationDebriefLoading(false);
    }
  }

  async function generateProgram(pivot = false, new_goal?: string, pivot_context?: string) {
    setProgramGenerating(true);
    try {
      const res = await fetch("/api/program/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pivot, new_goal, pivot_context }),
      });
      const d = await res.json();
      if (d.ok) {
        setProgramGenerated(true);
        await fetchData();
        // Open Franklin's reveal presentation
        if (d.block) {
          setRevealBlockData(d.block);
          setRevealMsgs([]);
          revealStarted.current = false;
          setRevealModal(true);
        }
      }
    } catch (err) {
      console.error("Program generation failed:", err);
    } finally {
      setProgramGenerating(false);
    }
  }

  async function fetchBlockDebrief() {
    setBlockDebriefLoading(true);
    setBlockDebrief("");
    try {
      const res = await fetch("/api/program/block-debrief", { method: "POST" });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        setBlockDebrief(buf);
      }
      await fetchData(); // Block status may have changed
    } finally {
      setBlockDebriefLoading(false);
    }
  }

  async function streamPivot(userMsg: string | null) {
    setPivotStreaming(true);
    const newHistory = userMsg
      ? [...pivotMsgs, { role: "user", content: userMsg }]
      : pivotMsgs;
    if (userMsg) setPivotMsgs([...newHistory, { role: "assistant", content: "" }]);
    else setPivotMsgs([{ role: "assistant", content: "" }]);

    let buf = "";
    let parsed: { new_goal: string; context: string } | null = null;
    try {
      const res = await fetch("/api/program/pivot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: userMsg ? newHistory.slice(0, -1) : [], message: userMsg || "" }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const visibleText = buf.replace(/\[PIVOT_READY\][\s\S]*?\[\/PIVOT_READY\]/g, "").trim();
        setPivotMsgs(prev => {
          const u = [...prev];
          u[u.length - 1] = { role: "assistant", content: visibleText };
          return u;
        });
      }
      const match = buf.match(/\[PIVOT_READY\]([\s\S]*?)\[\/PIVOT_READY\]/);
      if (match) {
        try { parsed = JSON.parse(match[1].trim()); } catch { /* ignore */ }
      }
      if (parsed) {
        setPivotReady(true);
        setPivotData(parsed);
      }
    } finally {
      setPivotStreaming(false);
    }
  }

  async function confirmPivot() {
    if (!pivotData) return;
    setPivotConfirming(true);
    await generateProgram(true, pivotData.new_goal, pivotData.context);
    setPivotModal(false);
    setPivotMsgs([]);
    setPivotReady(false);
    setPivotData(null);
    pivotStarted.current = false;
    setPivotConfirming(false);
    setNav("program");
  }

  async function fetchExHistory(exerciseName: string, rowIdx: number) {
    if (!exerciseName || exerciseName.length < 2) { setExHistory(p => ({ ...p, [rowIdx]: [] })); return; }
    const res = await fetch(`/api/program/exercise-history?exercise=${encodeURIComponent(exerciseName)}`);
    const d = await res.json();
    setExHistory(p => ({ ...p, [rowIdx]: d.history || [] }));
  }

  async function streamReveal(userMsg: string | null) {
    if (!revealBlockData) return;
    setRevealStreaming(true);
    const newHistory = userMsg
      ? [...revealMsgs, { role: "user", content: userMsg }]
      : revealMsgs;
    if (userMsg) setRevealMsgs([...newHistory, { role: "assistant", content: "" }]);
    else setRevealMsgs([{ role: "assistant", content: "" }]);
    let buf = "";
    try {
      const res = await fetch("/api/program/reveal", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: userMsg ? newHistory.slice(0, -1) : [],
          message: userMsg || null,
          block: revealBlockData,
        }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setRevealMsgs(prev => { const u = [...prev]; u[u.length - 1] = { role: "assistant", content: buf }; return u; });
      }
    } finally {
      setRevealStreaming(false);
    }
  }

  async function openTutorial(exerciseName: string) {
    setTutorialModal({ name: exerciseName, loading: true });
    try {
      const res = await fetch(`/api/exercise/tutorial?name=${encodeURIComponent(exerciseName)}`);
      const d = await res.json();
      setTutorialModal({ name: exerciseName, loading: false, data: d });
    } catch {
      setTutorialModal({
        name: exerciseName, loading: false,
        data: { youtube_url: `https://www.youtube.com/results?search_query=${encodeURIComponent(exerciseName + " exercise tutorial")}` },
      });
    }
  }

  async function logCycleStart() {
    setCycleLogging(true);
    const today = data?.today || new Date().toISOString().split("T")[0];
    try {
      await fetch("/api/cycle/log", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period_start_date: today }),
      });
      fetchData();
    } finally {
      setCycleLogging(false);
    }
  }

  async function compressImage(file: File): Promise<string> {
    // Convert HEIC/HEIF to JPEG first (iPhone default format)
    const isHeic = file.type === "image/heic" || file.type === "image/heif" ||
                   file.name.toLowerCase().endsWith(".heic") || file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      const heic2any = (await import("heic2any")).default;
      const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
      file = new File([converted as Blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const MAX = 1100;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
            else { width = Math.round(width * MAX / height); height = MAX; }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width; canvas.height = height;
          canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.72).split(",")[1]);
        };
        img.onerror = reject;
        img.src = dataUrl;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePhotoUpload(slot: string, file: File) {
    setPhotoConverting(slot);
    try {
      const b64 = await compressImage(file);
      setScreenPhotos(p => ({ ...p, [slot]: b64 }));
    } catch (err) {
      console.error("Photo upload failed:", err);
    } finally {
      setPhotoConverting(null);
    }
  }

  async function runScreening() {
    if (Object.keys(screenPhotos).length === 0 && !screenFindings.trim()) return;
    setScreenLoading(true);
    setScreenReport("");
    setScreenSaved(false);
    try {
      const res = await fetch("/api/dashboard/assess/screen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: screenPhotos, manualFindings: screenFindings }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        setScreenReport(buf);
      }
    } catch {
      setScreenReport("Error generating report. Try again.");
    } finally {
      setScreenLoading(false);
    }
  }

  function extractDominantPattern(report: string): string | null {
    const match = report.match(/Primary Pattern[:\s*_]+([^\n\*]+)/i);
    return match ? match[1].replace(/\*\*/g, "").trim() : null;
  }

  function extractShoulderFinding(report: string): string | null {
    const match = report.match(/Right Scapular[^\n]+|right shoulder[^\n]+/i);
    return match ? match[0].replace(/\*\*/g, "").trim().slice(0, 200) : null;
  }

  async function saveScreening() {
    if (!screenReport) return;
    setScreenSaving(true);
    const res = await fetch("/api/dashboard/assess/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_md: screenReport,
        dominant_pattern: extractDominantPattern(screenReport),
        shoulder_finding: extractShoulderFinding(screenReport),
        assessment_date: new Date().toISOString().slice(0, 10),
        photos: screenPhotos,
      }),
    });
    const saved = await res.json();
    setScreenSaving(false);
    setScreenSaved(true);
    if (saved.id) setScreenSavedId(saved.id);
    // Reload assessment data
    setAssessment(null);
    fetch("/api/dashboard/assessment").then(r => r.json()).then(d => setAssessment(d));
  }

  async function sendDiscuss(overrideMsg?: string) {
    const msg = (overrideMsg || discussInput).trim();
    if (!msg || discussStreaming) return;
    setDiscussInput("");
    const newMsgs = [...discussMsgs, { role: "user", content: msg }];
    setDiscussMsgs([...newMsgs, { role: "assistant", content: "" }]);
    setDiscussStreaming(true);
    let buf = "";
    try {
      const res = await fetch("/api/dashboard/assess/discuss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: screenReport, messages: newMsgs, message: msg }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        setDiscussMsgs([...newMsgs, { role: "assistant", content: buf }]);
      }
    } catch {
      setDiscussMsgs([...newMsgs, { role: "assistant", content: "Something went wrong. Try again." }]);
    } finally {
      setDiscussStreaming(false);
    }
  }

  async function lockPlan() {
    setPlanLocked(true);
    await sendDiscuss("Love it — let's go.");
  }

  async function sendChat(overrideMsg?: string) {
    const msg = (overrideMsg || chatInput).trim();
    if (!msg || streaming) return;
    setChatInput("");
    // Capture history before state update — only include messages with content
    const history = chatMsgs.filter(m => m.content);
    setChatMsgs(p => [...p, { role: "user", content: msg }, { role: "assistant", content: "" }]);
    setStreaming(true);
    let buf = "";
    try {
      const res = await fetch("/api/dashboard/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        setChatMsgs(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: buf }; return u; });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setChatMsgs(p => { const u = [...p]; u[u.length - 1] = { role: "assistant", content: `Something went wrong: ${msg}` }; return u; });
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

  const { session, week, weekSessions, health, block, limitations, insights, healthDate, today, athlete: athleteProfile } = data;
  const cyclePhase = athleteProfile?.cyclePhase;
  const unitSystem: UnitSystem = athleteProfile?.unitSystem || "metric";
  const wLabel = weightLabel(unitSystem);
  const readiness      = health?.readiness_call || "unknown";
  const rc             = READINESS_CONFIG[readiness] || READINESS_CONFIG.unknown;
  const shoulder       = limitations?.find((l: any) => l.limitation_type === "shoulder");
  const blockWeekPct   = block ? Math.min(100, Math.round((block.week / block.planned_weeks) * 100)) : 0;
  const healthIsStale  = healthDate && healthDate !== today;
  const blockIsComplete = block?.blockComplete === true;

  // Serve readiness-appropriate session content, with cycle phase override
  function getSessionContent(s: any): string {
    if (!s) return "";
    if (readiness === "red" && s.content_red_md) return s.content_red_md;
    if (readiness === "yellow" && s.content_yellow_md) return s.content_yellow_md;
    // Cycle phase override: late luteal or menstrual → serve modified variant even on green
    const cyclePhase = data.athlete?.cyclePhase?.phase;
    if (
      readiness !== "red" &&
      (cyclePhase === "late_luteal" || cyclePhase === "menstrual") &&
      s.content_yellow_md
    ) {
      return s.content_yellow_md;
    }
    return s.content_md || "";
  }

  // Whether the session is cycle-adjusted (for badge display)
  const isCycleAdjusted = (() => {
    const cyclePhase = data.athlete?.cyclePhase?.phase;
    return (
      readiness !== "red" &&
      readiness !== "yellow" &&
      (cyclePhase === "late_luteal" || cyclePhase === "menstrual")
    );
  })();

  const healthHistory: any[] = data.healthHistory || [];
  const hrvValues   = healthHistory.map((r: any) => r.hrv_sdnn).filter(Boolean);
  const sleepValues = healthHistory.map((r: any) => r.sleep_total_h).filter(Boolean);
  const rhrValues   = healthHistory.map((r: any) => r.resting_hr).filter(Boolean);
  const stepValues  = healthHistory.map((r: any) => r.steps).filter(Boolean);

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
            COACH FRANKLIN
          </div>
          <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
            Your coach — ask anything
          </div>
        </div>
        {isMobile && (
          <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "18px", padding: "4px 8px" }}>×</button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
        {chatMsgs.length === 0 && (() => {
          const suggestions: string[] = [];

          // Session-specific
          if (session) {
            suggestions.push(`Walk me through ${session.session_label}`);
            if (readiness === "yellow" || readiness === "red")
              suggestions.push(`My readiness is ${readiness} — how should I adjust today?`);
            else
              suggestions.push("What should I focus on technically today?");
            suggestions.push("I want to swap an exercise — what do you suggest?");
          } else {
            suggestions.push("No session today — what should I do?");
          }

          // Block / programming
          if (block) {
            suggestions.push(`How far am I into ${block.name}?`);
          } else {
            suggestions.push("When do I get my next training block?");
          }

          // Log / admin
          suggestions.push("Log a note about today's session");

          return (
            <div style={{ marginTop: "16px" }}>
              <p style={{ color: T.muted, fontSize: "12px", marginBottom: "14px", lineHeight: 1.5 }}>
                Franklin is ready. Ask anything — session questions, load adjustments, programming, or just how you&apos;re feeling going into today.
              </p>
              {suggestions.slice(0, 4).map(q => (
                <button key={q} onClick={() => sendChat(q)} style={{
                  display: "block", width: "100%", textAlign: "left",
                  background: T.surface2, border: `1px solid ${T.border}`,
                  borderRadius: "8px", color: T.muted, cursor: "pointer",
                  fontSize: "12px", padding: "9px 12px", marginBottom: "7px",
                  fontFamily: "inherit", lineHeight: 1.4,
                }}>{q}</button>
              ))}
            </div>
          );
        })()}
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
            placeholder="Message Coach Franklin…"
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

      {/* ── TOP NAV (desktop) ── */}
      {!isMobile && (
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "52px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "28px" }}>
            <img src="/logo-heilsa.png" alt="360 Heilsa" style={{ height: "28px", width: "auto", display: "block" }} />
            <div style={{ display: "flex", gap: "2px" }}>
              {([["today", "TODAY"], ["program", "PROGRAM"], ["history", "HISTORY"], ["running", "RUNNING"], ["assessment", "ASSESSMENT"], ["nutrition", "NUTRITION"]] as [NavItem, string][]).map(([id, label]) => (
                <button key={id} onClick={() => setNav(id)} style={{
                  border: "none", cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                  fontSize: "0.9rem", letterSpacing: "0.08em",
                  padding: "4px 14px", borderRadius: "6px",
                  color: nav === id ? T.accent : T.muted,
                  background: nav === id ? T.accentDim : "transparent",
                } as any}>{label}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {lastRefreshed && (
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
            <span style={{ fontSize: "12px", color: T.muted, textTransform: "capitalize" }}>{data.todayStr}</span>
            <button onClick={() => setChatOpen(o => !o)} style={{
              background: chatOpen ? T.accentDim : "none",
              border: `1px solid ${chatOpen ? T.accent : T.border}`,
              borderRadius: "6px", color: chatOpen ? T.accent : T.muted,
              cursor: "pointer", fontSize: "11px", fontWeight: 600,
              letterSpacing: "0.06em", padding: "4px 10px",
              fontFamily: "'BebasNeue', sans-serif",
            }}>
              {chatOpen ? "CLOSE" : "COACH"}
            </button>
            <a href="/dashboard/settings" style={{
              fontSize: "11px", color: T.muted, textDecoration: "none",
              fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.06em",
              padding: "4px 10px", border: `1px solid ${T.border}`, borderRadius: "6px",
            }}>⚙</a>
            <a href="/" style={{ fontSize: "11px", color: T.muted, textDecoration: "none" }}>← WEBSITE</a>
            <button
              onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}
              style={{
                background: "none", border: `1px solid ${T.border}`, borderRadius: "6px",
                color: T.muted, cursor: "pointer", fontSize: "11px", fontWeight: 600,
                letterSpacing: "0.06em", padding: "4px 10px",
                fontFamily: "'BebasNeue', sans-serif",
              }}
            >
              SIGN OUT
            </button>
          </div>
        </div>
      )}

      {/* ── MOBILE TOP BAR ── */}
      {isMobile && (
        <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: "52px", flexShrink: 0 }}>
          <img src="/logo-heilsa.png" alt="360 Heilsa" style={{ height: "26px", width: "auto", display: "block" }} />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={fetchData} disabled={refreshing} style={{
              background: "none", border: `1px solid ${T.border}`, borderRadius: "6px",
              color: refreshing ? T.accent : T.muted, cursor: "pointer",
              fontSize: "14px", padding: "6px 10px",
            }}>
              {refreshing ? "·" : "↻"}
            </button>
            <button onClick={() => setChatOpen(o => !o)} style={{
              background: chatOpen ? T.accentDim : "none",
              border: `1px solid ${chatOpen ? T.accent : T.border}`,
              borderRadius: "6px", color: chatOpen ? T.accent : T.muted,
              cursor: "pointer", fontSize: "11px", fontWeight: 600,
              letterSpacing: "0.06em", padding: "6px 10px",
              fontFamily: "'BebasNeue', sans-serif",
            }}>
              {chatOpen ? "✕" : "COACH"}
            </button>
          </div>
        </div>
      )}

      {/* ── BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", flexDirection: isMobile ? "column" : "row" }}>

        {/* ── MAIN CONTENT ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "12px 12px 80px" : "20px 24px" }}>

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
                  {cyclePhase && (
                    <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: cyclePhase.phase === "menstrual" ? T.red + "20" : cyclePhase.phase === "late_luteal" ? T.yellow + "20" : T.green + "15", color: cyclePhase.phase === "menstrual" ? T.red : cyclePhase.phase === "late_luteal" ? T.yellow : T.green, letterSpacing: "0.06em", marginBottom: "6px" }}>
                      {cyclePhase.label} · Day {cyclePhase.day}
                    </span>
                  )}
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
                <StatPill
                  label="Steps"
                  value={health?.steps ? health.steps.toLocaleString() : "—"}
                  color={health?.steps ? (
                    insights?.steps7d && health.steps >= insights.steps7d * 1.1 ? T.green :
                    insights?.steps7d && health.steps < insights.steps7d * 0.7 ? T.yellow :
                    T.text
                  ) : T.muted}
                />
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
                {stepValues.length > 1 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                      Steps 7d avg
                      {insights?.steps7d ? <span style={{ color: T.text, marginLeft: "6px" }}>{insights.steps7d.toLocaleString()}</span> : null}
                    </div>
                    <Sparkline values={stepValues} color={T.green} width={isMobile ? 80 : 100} />
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

          {/* FOUNDATION WEEK DEBRIEF BANNER */}
          {nav === "today" && foundationReady && (
            <div style={{
              background: `linear-gradient(135deg, rgba(200,169,110,0.1) 0%, ${T.surface2} 100%)`,
              border: `1px solid ${T.accent}40`, borderRadius: "12px",
              padding: "18px 20px", marginBottom: "14px",
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "32px", height: "32px", borderRadius: "50%",
                    background: T.accent, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "11px", color: T.bg, fontWeight: 700, flexShrink: 0,
                  }}>CF</div>
                  <div>
                    <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.06em", color: T.accent }}>
                      FOUNDATION WEEK COMPLETE
                    </div>
                    <div style={{ fontSize: "11px", color: T.muted }}>Franklin has reviewed your first week. Ready for the debrief.</div>
                  </div>
                </div>
                {!foundationDebrief && !foundationDebriefLoading && (
                  <button onClick={fetchFoundationDebrief} style={{
                    background: T.accent, border: "none", borderRadius: "8px",
                    color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                    fontSize: "0.85rem", letterSpacing: "0.08em", padding: "8px 18px", flexShrink: 0,
                  }}>READ DEBRIEF</button>
                )}
              </div>
              {(foundationDebrief || foundationDebriefLoading) && (
                <div style={{ fontSize: "14px", lineHeight: 1.8, color: T.text, whiteSpace: "pre-wrap", paddingTop: "4px", borderTop: `1px solid ${T.border}` }}>
                  {foundationDebrief || <span style={{ color: T.muted }}>▌</span>}
                  {foundationDebriefLoading && foundationDebrief && <span style={{ color: T.muted }}>▌</span>}
                </div>
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
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                          <Label>Training Plan</Label>
                          {(readiness === "yellow" && session.content_yellow_md) && (
                            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: T.yellow + "20", color: T.yellow, fontWeight: 600, letterSpacing: "0.06em" }}>MODIFIED</span>
                          )}
                          {(readiness === "red" && session.content_red_md) && (
                            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: T.red + "20", color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>RECOVERY</span>
                          )}
                          {isCycleAdjusted && session.content_yellow_md && (
                            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: "#9b59b620", color: "#9b59b6", fontWeight: 600, letterSpacing: "0.06em" }}>CYCLE ADJUSTED</span>
                          )}
                        </div>
                        <div style={{
                          background: T.bg, border: `1px solid ${T.border}`, borderRadius: "8px",
                          padding: "14px 16px", maxHeight: "280px", overflowY: "auto",
                        }}>
                          {getSessionContent(session) ? (
                            <SessionPlanRenderer content={getSessionContent(session)} onExerciseTap={openTutorial} />
                          ) : (
                            <span style={{ fontSize: "12px", color: T.muted }}>No plan yet — generate your program below.</span>
                          )}
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
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button onClick={() => { setSessionLogModal(true); setSessionLogDate(data?.today || ""); }} style={{
                      background: T.accentDim, border: `1px solid ${T.accent}`,
                      borderRadius: "8px", color: T.accent, cursor: "pointer",
                      fontSize: "11px", fontWeight: 700, padding: "7px 14px",
                      fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.08em",
                    }}>
                      + LOG SESSION
                    </button>
                    <button onClick={() => setDoneModal(true)} style={{
                      background: "transparent", border: `1px solid ${T.border}`,
                      borderRadius: "8px", color: T.muted, cursor: "pointer",
                      fontSize: "11px", fontWeight: 700, padding: "7px 14px",
                      fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.08em",
                    }}>
                      ✓ MARK DONE
                    </button>
                  </div>
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
                          {!isDone && !isMissed && (
                            <button
                              onClick={() => { setRescheduleId(s.id); setRescheduleDate(s.scheduled_date); }}
                              title="Move session"
                              style={{
                                background: "none", border: "none", cursor: "pointer",
                                color: T.muted, fontSize: "12px", padding: "2px 4px", flexShrink: 0,
                              }}
                            >⤵</button>
                          )}
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

          {/* PROGRAM TAB */}
          {nav === "program" && (() => {
            const hasBlock = !!block;
            const hasSessions = weekSessions.length > 0;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* ── Goal + pivot header ── */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
                  <div>
                    {athleteProfile?.goals && (
                      <div style={{ fontSize: "11px", color: T.muted }}>
                        <span style={{ color: T.accent, fontWeight: 600 }}>Goal:</span> {athleteProfile.goals}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => { setPivotModal(true); setPivotMsgs([]); setPivotReady(false); setPivotData(null); }}
                    style={{
                      background: "none", border: `1px solid ${T.border}`, borderRadius: "8px",
                      color: T.muted, cursor: "pointer", fontSize: "11px", fontWeight: 600,
                      letterSpacing: "0.06em", padding: "5px 12px", fontFamily: "'BebasNeue', sans-serif",
                    }}
                  >
                    ↺ CHANGE FOCUS
                  </button>
                </div>

                {/* ── Block complete → debrief banner ── */}
                {blockIsComplete && (
                  <div style={{
                    background: `linear-gradient(135deg, rgba(200,169,110,0.12) 0%, ${T.surface2} 100%)`,
                    border: `1px solid ${T.accent}50`, borderRadius: "12px",
                    padding: "18px 20px", display: "flex", flexDirection: "column", gap: "12px",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div style={{ width: "30px", height: "30px", borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: T.bg, fontWeight: 700, flexShrink: 0 }}>CF</div>
                        <div>
                          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.06em", color: T.accent }}>BLOCK COMPLETE</div>
                          <div style={{ fontSize: "11px", color: T.muted }}>Franklin has reviewed your block. Time for the debrief.</div>
                        </div>
                      </div>
                      {!blockDebrief && !blockDebriefLoading && (
                        <button onClick={fetchBlockDebrief} style={{
                          background: T.accent, border: "none", borderRadius: "8px",
                          color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                          fontSize: "0.85rem", letterSpacing: "0.08em", padding: "8px 18px", flexShrink: 0,
                        }}>READ DEBRIEF</button>
                      )}
                    </div>
                    {(blockDebrief || blockDebriefLoading) && (
                      <div style={{ fontSize: "14px", lineHeight: 1.8, color: T.text, whiteSpace: "pre-wrap", paddingTop: "4px", borderTop: `1px solid ${T.border}` }}>
                        {blockDebrief || <span style={{ color: T.muted }}>▌</span>}
                        {blockDebriefLoading && blockDebrief && <span style={{ color: T.muted }}>▌</span>}
                      </div>
                    )}
                    {blockDebrief && !blockDebriefLoading && (
                      <button
                        onClick={() => generateProgram(false)}
                        disabled={programGenerating}
                        style={{
                          background: programGenerating ? T.surface2 : T.accent,
                          border: `1px solid ${programGenerating ? T.border : T.accent}`,
                          borderRadius: "10px", color: programGenerating ? T.muted : T.bg,
                          cursor: programGenerating ? "default" : "pointer",
                          fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                          letterSpacing: "0.08em", padding: "12px",
                          width: "100%", transition: "all 0.15s",
                        }}
                      >
                        {programGenerating ? "BUILDING YOUR NEXT BLOCK…" : "BUILD NEXT BLOCK →"}
                      </button>
                    )}
                  </div>
                )}

                {/* Block overview */}
                {hasBlock && (
                  <Card>
                    <div style={{ padding: "18px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "10px", color: T.muted, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "6px" }}>
                          Current Block · Week {block.week} of {block.planned_weeks}
                        </div>
                        <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", marginBottom: "8px" }}>
                          {block.name}
                        </div>
                        {block.intent && (
                          <p style={{ fontSize: "13px", color: T.muted, lineHeight: 1.6, margin: 0 }}>{block.intent}</p>
                        )}
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "24px", fontFamily: "'BebasNeue', sans-serif", color: T.accent }}>{blockWeekPct}%</div>
                        <div style={{ fontSize: "10px", color: T.muted }}>complete</div>
                      </div>
                    </div>
                    <div style={{ padding: "0 20px 16px" }}>
                      <div style={{ background: T.border, borderRadius: "999px", height: "4px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: T.accent, width: `${blockWeekPct}%`, borderRadius: "999px", transition: "width 0.5s" }} />
                      </div>
                    </div>
                  </Card>
                )}

                {/* This week's sessions */}
                {hasSessions ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted }}>
                      This Week
                    </div>
                    {weekSessions.map((s: any) => {
                      const isToday = s.scheduled_date === today;
                      const isDone  = s.status === "completed";
                      const isMissed = s.status === "missed";
                      return (
                        <Card key={s.id} style={{ border: isToday ? `1px solid ${T.accent}40` : undefined }}>
                          <div style={{ padding: "16px 20px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: s.notes ? "10px" : 0 }}>
                              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                                <span style={{ fontSize: "1.4rem" }}>{SESSION_ICONS[s.session_type] || "📋"}</span>
                                <div>
                                  <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.04em", color: isToday ? T.accent : T.text }}>
                                    {s.label}
                                  </div>
                                  <div style={{ fontSize: "10px", color: T.muted, marginTop: "2px" }}>
                                    {s.scheduled_date}{isToday ? " · TODAY" : ""}
                                    {s.shoulder_risk && s.shoulder_risk !== "low" && (
                                      <span style={{ marginLeft: "8px", color: s.shoulder_risk === "high" ? T.red : T.yellow }}>
                                        ⚠ Shoulder {s.shoulder_risk}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <Badge color={isDone ? T.green : isMissed ? T.red : isToday ? T.accent : T.muted}>
                                {isDone ? "✓ Done" : isMissed ? "Missed" : isToday ? "Today" : "Upcoming"}
                              </Badge>
                            </div>
                            {s.notes && (
                              <div style={{
                                fontSize: "12px", color: T.muted, lineHeight: 1.6,
                                background: T.surface2, borderRadius: "8px",
                                padding: "10px 12px", fontFamily: "ui-monospace, 'SF Mono', monospace",
                                whiteSpace: "pre-wrap",
                              }}>
                                {s.notes}
                              </div>
                            )}
                            {!isDone && !isMissed && (
                              <div style={{ marginTop: "10px", display: "flex", gap: "8px" }}>
                                {isToday && (
                                  <button
                                    onClick={() => { setSessionLogModal(true); setSessionLogDate(data?.today || ""); }}
                                    style={{
                                      flex: 1, background: T.accentDim,
                                      border: `1px solid ${T.accent}`, borderRadius: "8px",
                                      color: T.accent, cursor: "pointer",
                                      fontFamily: "'BebasNeue', sans-serif", fontSize: "0.85rem",
                                      letterSpacing: "0.08em", padding: "7px 16px",
                                    }}
                                  >
                                    + LOG THIS SESSION
                                  </button>
                                )}
                                <button
                                  onClick={() => { setRescheduleId(s.id); setRescheduleDate(s.scheduled_date); }}
                                  style={{
                                    background: "transparent", border: `1px solid ${T.border}`,
                                    borderRadius: "8px", color: T.muted, cursor: "pointer",
                                    fontSize: "0.8rem", padding: "7px 14px",
                                  }}
                                >
                                  Move
                                </button>
                              </div>
                            )}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                ) : !blockIsComplete ? (
                  <Card>
                    <div style={{ padding: "32px 24px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
                      <div style={{ fontSize: "32px" }}>⚡</div>
                      <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.06em", color: T.text }}>
                        Ready to Build Your Program
                      </div>
                      <p style={{ fontSize: "13px", color: T.muted, lineHeight: 1.7, maxWidth: "360px", margin: 0 }}>
                        Franklin has your movement screen data, health baselines, and schedule. Hit the button — he'll generate your full training block now.
                      </p>
                      <button
                        onClick={() => generateProgram(false)}
                        disabled={programGenerating}
                        style={{
                          background: programGenerating ? T.surface2 : T.accent,
                          border: `1px solid ${programGenerating ? T.border : T.accent}`,
                          borderRadius: "10px", color: programGenerating ? T.muted : T.bg,
                          cursor: programGenerating ? "default" : "pointer",
                          fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem",
                          letterSpacing: "0.1em", padding: "14px 32px",
                          transition: "all 0.15s",
                        }}
                      >
                        {programGenerating ? "BUILDING YOUR PROGRAM…" : "BUILD MY PROGRAM →"}
                      </button>
                      {programGenerating && (
                        <p style={{ fontSize: "12px", color: T.muted }}>
                          Franklin is designing your block — this takes about 30 seconds.
                        </p>
                      )}
                    </div>
                  </Card>
                ) : null}

                {/* Recent session logs */}
                {data.recentLogs?.length > 0 && (
                  <Card>
                    <CardHeader left="Recent Sessions" right={<span style={{ fontSize: "10px", color: T.muted }}>{data.recentLogs.length} logged</span>} />
                    <div>
                      {data.recentLogs.map((log: any) => (
                        <div key={log.id} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.04em", marginBottom: "3px" }}>
                              {SESSION_ICONS[log.session_type]} {log.label || log.session_type}
                            </div>
                            {log.top_sets?.length > 0 && (
                              <div style={{ fontSize: "11px", color: T.muted }}>
                                {log.top_sets.slice(0, 3).map((s: any, i: number) => (
                                  <span key={i} style={{ marginRight: "10px" }}>
                                    {s.exercise}{s.load_kg ? ` ${formatWeight(s.load_kg, unitSystem)}` : ""}{s.sets && s.reps ? ` ${s.sets}×${s.reps}` : ""}
                                  </span>
                                ))}
                              </div>
                            )}
                            {log.notes && <p style={{ fontSize: "11px", color: T.muted, margin: "3px 0 0", fontStyle: "italic" }}>{log.notes}</p>}
                          </div>
                          <div style={{ textAlign: "right", flexShrink: 0, marginLeft: "12px" }}>
                            <div style={{ fontSize: "10px", color: T.muted }}>{log.log_date}</div>
                            {log.rpe_overall && <div style={{ fontSize: "11px", color: T.accent, marginTop: "2px" }}>RPE {log.rpe_overall}</div>}
                            {log.duration_min && <div style={{ fontSize: "10px", color: T.muted }}>{log.duration_min}min</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            );
          })()}

          {/* HISTORY VIEW */}
          {nav === "history" && (() => {
            const hist90: any[] = data.healthHistory || [];
            const rhrHist   = hist90.filter((r: any) => r.resting_hr);
            const sleepHist = hist90.filter((r: any) => r.sleep_total_h);
            const stepHist  = hist90.filter((r: any) => r.steps);
            const stepAvg   = stepHist.length ? Math.round(stepHist.reduce((s: number, r: any) => s + r.steps, 0) / stepHist.length) : 0;
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* 90-day sparkline cards */}
                {(sleepHist.length > 1 || rhrHist.length > 1) && (
                  <Card>
                    <CardHeader left="90-Day Health Trends" />
                    <div style={{ padding: "20px 20px", display: "flex", gap: "32px", flexWrap: "wrap" }}>
                      {sleepHist.length > 1 && (
                        <div>
                          <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                            Sleep (hours/night)
                            <span style={{ color: T.text, marginLeft: "8px" }}>
                              {(sleepHist.reduce((s: number, r: any) => s + r.sleep_total_h, 0) / sleepHist.length).toFixed(1)}h avg
                            </span>
                          </div>
                          <Sparkline values={sleepHist.map((r: any) => r.sleep_total_h)} color={T.blue} width={isMobile ? 160 : 240} height={40} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: T.muted, marginTop: "4px" }}>
                            <span>{sleepHist[0]?.metric_date?.slice(5)}</span>
                            <span>{sleepHist[sleepHist.length - 1]?.metric_date?.slice(5)}</span>
                          </div>
                        </div>
                      )}
                      {rhrHist.length > 1 && (
                        <div>
                          <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                            Resting HR (bpm)
                            <span style={{ color: T.text, marginLeft: "8px" }}>
                              {Math.round(rhrHist.reduce((s: number, r: any) => s + r.resting_hr, 0) / rhrHist.length)} avg
                            </span>
                          </div>
                          <Sparkline values={rhrHist.map((r: any) => r.resting_hr)} color={T.yellow} width={isMobile ? 160 : 240} height={40} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: T.muted, marginTop: "4px" }}>
                            <span>{rhrHist[0]?.metric_date?.slice(5)}</span>
                            <span>{rhrHist[rhrHist.length - 1]?.metric_date?.slice(5)}</span>
                          </div>
                        </div>
                      )}
                      {hist90.filter((r: any) => r.hrv_sdnn).length > 1 && (
                        <div>
                          <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                            HRV SDNN (ms)
                            <span style={{ color: T.text, marginLeft: "8px" }}>
                              {(() => {
                                const h = hist90.filter((r: any) => r.hrv_sdnn);
                                return (h.reduce((s: number, r: any) => s + r.hrv_sdnn, 0) / h.length).toFixed(0);
                              })()}ms avg
                            </span>
                          </div>
                          <Sparkline values={hist90.filter((r: any) => r.hrv_sdnn).map((r: any) => r.hrv_sdnn)} color={T.green} width={isMobile ? 160 : 240} height={40} />
                        </div>
                      )}
                      {stepHist.length > 1 && (
                        <div>
                          <div style={{ fontSize: "9px", color: T.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "6px" }}>
                            Daily Steps
                            <span style={{ color: T.text, marginLeft: "8px" }}>{stepAvg.toLocaleString()} avg</span>
                          </div>
                          <Sparkline values={stepHist.map((r: any) => r.steps)} color={T.green} width={isMobile ? 160 : 240} height={40} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9px", color: T.muted, marginTop: "4px" }}>
                            <span>{stepHist[0]?.metric_date?.slice(5)}</span>
                            <span>{stepHist[stepHist.length - 1]?.metric_date?.slice(5)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {/* Day-by-day table */}
                <Card>
                  <CardHeader left="Daily Log (90 days)" right={<span style={{ fontSize: "10px", color: T.muted }}>{hist90.length} entries</span>} />
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                      <thead>
                        <tr style={{ background: T.surface2 }}>
                          {["Date", "RHR", "HRV", "Sleep", "Deep", "REM", "Steps"].map(h => (
                            <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "9px", color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...hist90].reverse().slice(0, 90).map((row: any) => (
                          <tr key={row.metric_date} style={{ borderBottom: `1px solid ${T.border}` }}>
                            <td style={{ padding: "7px 12px", color: T.muted, whiteSpace: "nowrap" }}>{row.metric_date}</td>
                            <td style={{ padding: "7px 12px", color: row.resting_hr ? T.text : T.border }}>{row.resting_hr ?? "—"}</td>
                            <td style={{ padding: "7px 12px", color: row.hrv_sdnn ? T.green : T.border }}>{row.hrv_sdnn ?? "—"}</td>
                            <td style={{ padding: "7px 12px", color: row.sleep_total_h ? T.text : T.border }}>{row.sleep_total_h ? row.sleep_total_h.toFixed(1) + "h" : "—"}</td>
                            <td style={{ padding: "7px 12px", color: row.sleep_deep_h ? T.blue : T.border }}>{row.sleep_deep_h ? row.sleep_deep_h.toFixed(1) + "h" : "—"}</td>
                            <td style={{ padding: "7px 12px", color: row.sleep_rem_h ? T.accent : T.border }}>{row.sleep_rem_h ? row.sleep_rem_h.toFixed(1) + "h" : "—"}</td>
                            <td style={{ padding: "7px 12px", color: row.steps ? T.text : T.border }}>{row.steps ? row.steps.toLocaleString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>

                {/* Session logs */}
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
              </div>
            );
          })()}

          {/* RUNNING TAB */}
          {nav === "running" && (() => {
            const allRuns = runs;
            const runOnly = allRuns.filter(a => ["Run", "TrailRun", "VirtualRun"].includes(a.sport_type));
            const recentRuns = runOnly.slice(0, 20);

            function fmtPace(min_km: number | null) {
              if (!min_km) return "—";
              const mins = Math.floor(min_km);
              const secs = Math.round((min_km - mins) * 60);
              return `${mins}:${secs.toString().padStart(2, "0")}/km`;
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <Card>
                  <CardHeader
                    left={`Running — ${runOnly.length} runs`}
                    right={
                      <button onClick={fetchRuns} disabled={runsLoading} style={{
                        background: "none", border: `1px solid ${T.border}`, borderRadius: "5px",
                        color: T.muted, cursor: "pointer", fontSize: "10px", padding: "2px 8px",
                      }}>
                        {runsLoading ? "…" : "↻"}
                      </button>
                    }
                  />
                  {runsLoading && (
                    <p style={{ padding: "20px", color: T.muted, fontSize: "13px" }}>Loading…</p>
                  )}
                  {!runsLoading && runOnly.length === 0 && (
                    <div style={{ padding: "20px" }}>
                      <p style={{ color: T.muted, fontSize: "13px", marginBottom: "8px" }}>No runs synced yet.</p>
                      <p style={{ color: T.muted, fontSize: "12px", lineHeight: 1.6 }}>
                        Run: <code style={{ color: T.accent, background: T.surface2, padding: "1px 6px", borderRadius: "4px" }}>
                          HEALTH_INGEST_SECRET=xxx python3 automation/strava-to-supabase.py
                        </code>
                      </p>
                    </div>
                  )}
                  {!runsLoading && recentRuns.length > 0 && (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: T.surface2 }}>
                            {["Date", "Name", "Dist", "Pace", "Avg HR", "Elev"].map(h => (
                              <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: "9px", color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentRuns.map((r: any) => (
                            <tr key={r.strava_id} style={{ borderBottom: `1px solid ${T.border}` }}>
                              <td style={{ padding: "8px 12px", color: T.muted, whiteSpace: "nowrap" }}>{r.activity_date}</td>
                              <td style={{ padding: "8px 12px", color: T.text, maxWidth: "180px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                <a href={r.strava_url} target="_blank" rel="noopener noreferrer" style={{ color: T.text, textDecoration: "none" }}>
                                  {r.name || "Run"}
                                </a>
                              </td>
                              <td style={{ padding: "8px 12px", color: T.text, fontWeight: 600 }}>{r.distance_km ? r.distance_km.toFixed(2) + " km" : "—"}</td>
                              <td style={{ padding: "8px 12px", color: T.accent }}>{fmtPace(r.avg_pace_min_km)}</td>
                              <td style={{ padding: "8px 12px", color: r.avg_hr ? (r.avg_hr > 160 ? T.red : r.avg_hr > 145 ? T.yellow : T.text) : T.border }}>
                                {r.avg_hr ? `${Math.round(r.avg_hr)} bpm` : "—"}
                              </td>
                              <td style={{ padding: "8px 12px", color: T.muted }}>{r.elevation_gain_m ? `${Math.round(r.elevation_gain_m)}m` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>

                {/* All activities (non-run) */}
                {!runsLoading && allRuns.filter(a => !["Run", "TrailRun", "VirtualRun"].includes(a.sport_type)).length > 0 && (
                  <Card>
                    <CardHeader left="Other Activities" />
                    <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {allRuns.filter(a => !["Run", "TrailRun", "VirtualRun"].includes(a.sport_type)).slice(0, 20).map((a: any) => (
                        <div key={a.strava_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                          <div>
                            <span style={{ fontSize: "12px", color: T.muted, marginRight: "10px" }}>{a.sport_type}</span>
                            <a href={a.strava_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: "13px", color: T.text, textDecoration: "none" }}>{a.name || a.sport_type}</a>
                          </div>
                          <div style={{ textAlign: "right", fontSize: "11px", color: T.muted, flexShrink: 0 }}>
                            <div>{a.activity_date}</div>
                            {a.duration_min && <div>{Math.round(a.duration_min)} min</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            );
          })()}

          {/* ASSESSMENT TAB */}
          {nav === "assessment" && (() => {
            if (assessLoading) return <p style={{ color: T.muted, fontSize: "13px", padding: "20px 0" }}>Loading…</p>;
            const limitations: any[] = assessment?.limitations || [];
            const logs: any[]        = assessment?.logs || [];
            const assessments: any[] = assessment?.assessments || [];

            const statusColor = (s: string) =>
              s === "monitoring" ? T.yellow : s === "managed" ? T.blue : s === "resolved" ? T.green : T.muted;

            function daysUntil(dateStr: string | null) {
              if (!dateStr) return null;
              return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
            }

            // Screening retest logic
            const lastScreening  = assessments?.[0];
            const lastScreenDate = lastScreening?.assessment_date;
            const weeksSinceScreen = lastScreenDate
              ? Math.floor((Date.now() - new Date(lastScreenDate).getTime()) / (7 * 24 * 60 * 60 * 1000))
              : null;
            const recentPainCount = (data.recentLogs || []).slice(0, 7).filter(
              (l: any) => l.shoulder_status === "moderate" || l.shoulder_status === "significant"
            ).length;
            const showRetestCard = (weeksSinceScreen !== null && weeksSinceScreen >= 8) || recentPainCount >= 3;
            const retestReason   = recentPainCount >= 3
              ? `You've logged shoulder discomfort in ${recentPainCount} recent sessions.`
              : weeksSinceScreen !== null
              ? `It's been ${weeksSinceScreen} weeks since your last screening.`
              : "";

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Screening retest trigger */}
                {showRetestCard && (
                  <div style={{
                    background: `linear-gradient(135deg, rgba(200,169,110,0.08) 0%, ${T.surface2} 100%)`,
                    border: `1px solid ${recentPainCount >= 3 ? T.yellow + "60" : T.accent + "40"}`,
                    borderRadius: "12px", padding: "16px 18px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px",
                  }}>
                    <div>
                      <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.06em", color: T.accent, marginBottom: "3px" }}>
                        TIME FOR A RESCREEN
                      </div>
                      <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.5 }}>{retestReason} A follow-up screen will show what&apos;s changed.</div>
                    </div>
                    <button
                      onClick={() => { setShowScreening(true); setScreenReport(""); setScreenPhotos({}); setScreenFindings(""); setScreenSaved(false); }}
                      style={{
                        background: T.accentDim, border: `1px solid ${T.accent}`,
                        borderRadius: "8px", color: T.accent, cursor: "pointer",
                        fontFamily: "'BebasNeue', sans-serif", fontSize: "0.8rem",
                        letterSpacing: "0.08em", padding: "8px 14px", flexShrink: 0,
                      }}
                    >
                      RESCREEN →
                    </button>
                  </div>
                )}

                {/* Active limitations */}
                <Card>
                  <CardHeader left="Active Limitations" right={
                    <span style={{ fontSize: "10px", color: T.muted }}>{limitations.filter(l => l.status !== "resolved").length} active</span>
                  } />
                  {limitations.length === 0 ? (
                    <p style={{ padding: "16px 20px", color: T.muted, fontSize: "13px" }}>No limitations recorded.</p>
                  ) : (
                    <div style={{ padding: "0 0 4px" }}>
                      {limitations.map((lim: any) => {
                        const days = daysUntil(lim.escalation_deadline);
                        const urgent = days !== null && days <= 14 && lim.status !== "resolved";
                        return (
                          <div key={lim.id} style={{ padding: "14px 20px", borderBottom: `1px solid ${T.border}` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                                <span style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.04em", textTransform: "capitalize" }}>
                                  {lim.limitation_type} {lim.side && lim.side !== "na" ? `(${lim.side})` : ""}
                                </span>
                                <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "99px", background: statusColor(lim.status) + "20", color: statusColor(lim.status), fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                                  {lim.status}
                                </span>
                              </div>
                              {lim.escalation_deadline && (
                                <span style={{ fontSize: "10px", color: urgent ? T.red : T.muted, flexShrink: 0 }}>
                                  {urgent ? "⚠ " : ""}Physio by {lim.escalation_deadline} {days !== null ? `(${days}d)` : ""}
                                </span>
                              )}
                            </div>
                            <p style={{ fontSize: "13px", color: T.muted, lineHeight: 1.5, margin: "0 0 8px" }}>{lim.description}</p>
                            {lim.programming_constraints?.avoid?.length > 0 && (
                              <div style={{ fontSize: "11px", color: T.red + "cc" }}>
                                Avoid: {lim.programming_constraints.avoid.join(", ")}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

                {/* Shoulder log */}
                {logs.length > 0 && (
                  <Card>
                    <CardHeader left="Shoulder Log" right={<span style={{ fontSize: "10px", color: T.muted }}>{logs.length} entries</span>} />
                    <div>
                      {logs.map((log: any) => (
                        <div key={log.id} style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                            <span style={{ fontSize: "12px", fontWeight: 600 }}>{log.exercise || "General"}</span>
                            <div style={{ display: "flex", gap: "10px", alignItems: "center", flexShrink: 0 }}>
                              {log.severity_1_10 != null && (
                                <span style={{ fontSize: "11px", color: log.severity_1_10 === 0 ? T.green : log.severity_1_10 <= 3 ? T.yellow : T.red }}>
                                  {log.severity_1_10 === 0 ? "No issues" : `${log.severity_1_10}/10`}
                                </span>
                              )}
                              <span style={{ fontSize: "10px", color: T.muted }}>{log.log_date}</span>
                            </div>
                          </div>
                          {log.notes && <p style={{ fontSize: "12px", color: T.muted, lineHeight: 1.5, margin: 0 }}>{log.notes}</p>}
                          {log.what_helped && <p style={{ fontSize: "11px", color: T.green + "cc", margin: "4px 0 0" }}>Helped: {log.what_helped}</p>}
                          {log.what_worsened && <p style={{ fontSize: "11px", color: T.red + "cc", margin: "4px 0 0" }}>Worsened: {log.what_worsened}</p>}
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Postural screening */}
                <Card>
                  <CardHeader
                    left="Postural Screenings"
                    right={
                      !showScreening ? (
                        <button onClick={() => { setShowScreening(true); setScreenReport(""); setScreenPhotos({}); setScreenFindings(""); setScreenSaved(false); }} style={{
                          background: T.accentDim, border: `1px solid ${T.accent}`, borderRadius: "6px",
                          color: T.accent, cursor: "pointer", fontSize: "10px", fontWeight: 700,
                          letterSpacing: "0.08em", padding: "3px 10px", fontFamily: "'BebasNeue', sans-serif",
                        }}>+ NEW SCREENING</button>
                      ) : (
                        <button onClick={() => setShowScreening(false)} style={{
                          background: "none", border: `1px solid ${T.border}`, borderRadius: "6px",
                          color: T.muted, cursor: "pointer", fontSize: "10px", padding: "3px 10px",
                        }}>✕ Cancel</button>
                      )
                    }
                  />

                  {/* Screening form */}
                  {showScreening && (
                    <div style={{ padding: "20px", borderBottom: `1px solid ${T.border}` }}>

                      {/* Setup instructions */}
                      <div style={{
                        background: T.surface2, border: `1px solid ${T.border2}`,
                        borderRadius: "10px", padding: "14px 16px", marginBottom: "20px",
                        display: "flex", gap: "12px", alignItems: "flex-start",
                      }}>
                        <span style={{ fontSize: "20px", flexShrink: 0, marginTop: "1px" }}>📋</span>
                        <div>
                          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.9rem", letterSpacing: "0.06em", marginBottom: "6px", color: T.accent }}>SETUP</div>
                          <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.7 }}>
                            Barefoot · No shirt · Plain wall behind you · Camera at shoulder height · 2.5–3m away · Natural stance, don&apos;t fix your posture
                          </div>
                        </div>
                      </div>

                      {/* Photo upload slots */}
                      <div style={{ marginBottom: "20px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                          <Label>Photos</Label>
                          <span style={{ fontSize: "11px", color: Object.keys(screenPhotos).length === 4 ? T.green : T.muted }}>
                            {Object.keys(screenPhotos).length}/4 uploaded
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: "10px" }}>
                          {([
                            ["right_lateral", "Right Side",  "Stand with your right side to the camera"],
                            ["left_lateral",  "Left Side",   "Stand with your left side to the camera"],
                            ["anterior",      "Front",       "Face the camera directly"],
                            ["posterior",     "Back",        "Turn your back to the camera"],
                          ] as [string, string, string][]).map(([slot, label, hint]) => (
                            <div key={slot}>
                              <div
                                onClick={() => photoInputRef.current[slot]?.click()}
                                style={{
                                  cursor: "pointer",
                                  border: `1.5px ${screenPhotos[slot] ? "solid" : "dashed"} ${screenPhotos[slot] ? T.accent : T.border}`,
                                  borderRadius: "10px",
                                  background: screenPhotos[slot] ? T.accentDim : T.surface2,
                                  aspectRatio: "3/4", display: "flex", flexDirection: "column",
                                  alignItems: "center", justifyContent: "center", overflow: "hidden",
                                  transition: "border-color 0.15s, background 0.15s",
                                  position: "relative" as const,
                                }}>
                                {photoConverting === slot ? (
                                  <div style={{ textAlign: "center", padding: "8px" }}>
                                    <div style={{ fontSize: "20px", marginBottom: "6px" }}>⏳</div>
                                    <div style={{ fontSize: "10px", color: T.accent, letterSpacing: "0.06em", textTransform: "uppercase" as const }}>Converting…</div>
                                  </div>
                                ) : screenPhotos[slot] ? (
                                  <>
                                    <img
                                      src={`data:image/jpeg;base64,${screenPhotos[slot]}`}
                                      alt={label}
                                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                    />
                                    <div style={{
                                      position: "absolute" as const, bottom: "6px", right: "6px",
                                      background: T.accent, borderRadius: "50%",
                                      width: "20px", height: "20px", display: "flex",
                                      alignItems: "center", justifyContent: "center",
                                      fontSize: "11px", color: T.bg, fontWeight: 700,
                                    }}>✓</div>
                                  </>
                                ) : (
                                  <div style={{ textAlign: "center", padding: "8px" }}>
                                    <div style={{ fontSize: "24px", marginBottom: "6px" }}>📷</div>
                                    <div style={{ fontSize: "10px", color: T.accent, letterSpacing: "0.06em", textTransform: "uppercase" as const, fontFamily: "'BebasNeue', sans-serif", marginBottom: "4px" }}>{label}</div>
                                    <div style={{ fontSize: "9px", color: T.muted, lineHeight: 1.4 }}>{hint}</div>
                                  </div>
                                )}
                              </div>
                              <input
                                ref={el => { photoInputRef.current[slot] = el; }}
                                type="file" accept="image/*,.heic,.heif"
                                style={{ display: "none" }}
                                onChange={e => {
                                  const file = e.target.files?.[0];
                                  if (file) handlePhotoUpload(slot, file);
                                  e.target.value = "";
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Manual findings */}
                      <div style={{ marginBottom: "18px" }}>
                        <Label>Self-reported findings <span style={{ fontFamily: "inherit", fontSize: "10px", color: T.muted, fontWeight: 400, textTransform: "none" as const, letterSpacing: 0 }}>(optional)</span></Label>
                        <p style={{ fontSize: "11px", color: T.muted, marginBottom: "8px", lineHeight: 1.6 }}>
                          Thomas test, ASLR, ankle dorsiflexion, wall angels, overhead squat, breathing pattern. Side differences, what passed, what was restricted.
                        </p>
                        <textarea
                          value={screenFindings}
                          onChange={e => setScreenFindings(e.target.value)}
                          placeholder={"Thomas: R thigh above surface, L passed\nASLR: R 70°, L 80°\nOverhead squat: arms fell forward\nBreathing: chest-dominant"}
                          rows={4}
                          style={{
                            width: "100%", background: T.bg, border: `1px solid ${T.border}`,
                            borderRadius: "8px", color: T.text, fontFamily: "ui-monospace, 'SF Mono', monospace",
                            fontSize: "12px", padding: "10px 12px", resize: "vertical", outline: "none",
                            boxSizing: "border-box" as const, lineHeight: 1.6,
                          }}
                        />
                      </div>

                      <button
                        onClick={runScreening}
                        disabled={screenLoading || (Object.keys(screenPhotos).length === 0 && !screenFindings.trim())}
                        style={{
                          background: screenLoading ? T.surface2 : T.accent,
                          border: `1px solid ${screenLoading ? T.border : T.accent}`,
                          borderRadius: "8px", color: screenLoading ? T.muted : T.bg,
                          cursor: screenLoading ? "default" : "pointer",
                          fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem",
                          letterSpacing: "0.08em", padding: "12px 32px",
                          width: "100%", transition: "all 0.15s",
                        }}
                      >
                        {screenLoading ? ANALYZE_STEPS[analyzeStep] : "RUN SCREENING"}
                      </button>

                      {/* Report display */}
                      {(screenReport || screenLoading) && (() => {
                        // Parse report into named sections
                        function extractSection(text: string, heading: string): string {
                          const re = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |\\n---|\$)`);
                          const m = text.match(re);
                          return m ? m[1].trim() : "";
                        }

                        const coachAssessment   = extractSection(screenReport, "Coach Franklin's Assessment");
                        const implementing      = extractSection(screenReport, "What We're Implementing");
                        const programming       = extractSection(screenReport, "How This Shapes Your Programming");
                        const sixWeekGoal       = extractSection(screenReport, "6-Week Goal");
                        const splitIdx          = screenReport.indexOf("## Clinical Detail");
                        const clinicalPart      = splitIdx > -1 ? screenReport.slice(splitIdx) : "";
                        const stillStreaming     = screenLoading;

                        // Parse "What We're Implementing" into numbered items
                        const implItems = implementing
                          .split(/\n(?=\d+\.)/)
                          .map(s => s.replace(/^\d+\.\s*/, "").trim())
                          .filter(Boolean);

                        return (
                          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>

                            {/* Save button */}
                            {screenReport && !screenLoading && (
                              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                <button
                                  onClick={saveScreening}
                                  disabled={screenSaving || screenSaved}
                                  style={{
                                    background: screenSaved ? T.green + "20" : T.accentDim,
                                    border: `1px solid ${screenSaved ? T.green : T.accent}`,
                                    borderRadius: "6px", color: screenSaved ? T.green : T.accent,
                                    cursor: screenSaved ? "default" : "pointer",
                                    fontFamily: "'BebasNeue', sans-serif", fontSize: "0.85rem",
                                    letterSpacing: "0.06em", padding: "6px 18px",
                                    opacity: screenSaving ? 0.6 : 1,
                                  }}
                                >
                                  {screenSaved ? "✓ SAVED TO RECORD" : screenSaving ? "SAVING…" : "SAVE TO RECORD"}
                                </button>
                              </div>
                            )}

                            {/* Coach assessment card */}
                            {(coachAssessment || (stillStreaming && !coachAssessment)) && (
                              <div style={{
                                background: `linear-gradient(135deg, ${T.surface2} 0%, rgba(200,169,110,0.06) 100%)`,
                                border: `1px solid ${T.accentDim.replace("0.12", "0.25")}`,
                                borderRadius: "12px", padding: "20px 22px",
                              }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                                  <div style={{
                                    width: "32px", height: "32px", borderRadius: "50%",
                                    background: T.accent, display: "flex", alignItems: "center",
                                    justifyContent: "center", fontSize: "14px", flexShrink: 0,
                                  }}>CF</div>
                                  <div>
                                    <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.06em", color: T.accent }}>COACH FRANKLIN</div>
                                    <div style={{ fontSize: "10px", color: T.muted }}>Postural Assessment</div>
                                  </div>
                                </div>
                                <div style={{ fontSize: "14px", lineHeight: 1.85, color: T.text, whiteSpace: "pre-wrap" }}>
                                  {coachAssessment || <span style={{ color: T.muted }}>▌</span>}
                                  {stillStreaming && !implementing && <span style={{ color: T.muted }}>▌</span>}
                                </div>
                              </div>
                            )}

                            {/* Implementation items */}
                            {(implItems.length > 0 || (stillStreaming && coachAssessment)) && (
                              <div>
                                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.85rem", letterSpacing: "0.1em", color: T.muted, marginBottom: "10px" }}>WHAT WE&apos;RE IMPLEMENTING</div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                                  {implItems.map((item, i) => (
                                    <div key={i} style={{
                                      background: T.surface2, border: `1px solid ${T.border}`,
                                      borderRadius: "10px", padding: "14px 16px",
                                      display: "flex", gap: "14px", alignItems: "flex-start",
                                    }}>
                                      <div style={{
                                        width: "24px", height: "24px", borderRadius: "50%",
                                        background: T.accentDim, border: `1px solid ${T.accent}`,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontFamily: "'BebasNeue', sans-serif", fontSize: "0.85rem",
                                        color: T.accent, flexShrink: 0, marginTop: "1px",
                                      }}>{i + 1}</div>
                                      <div style={{ fontSize: "13px", lineHeight: 1.7, color: T.text }}>{item}</div>
                                    </div>
                                  ))}
                                  {stillStreaming && implItems.length === 0 && (
                                    <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "10px", padding: "14px 16px", color: T.muted, fontSize: "13px" }}>▌</div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Programming implications */}
                            {(programming || (stillStreaming && implementing)) && (
                              <div style={{
                                background: T.surface2, border: `1px solid ${T.border}`,
                                borderLeft: `3px solid ${T.accent}`,
                                borderRadius: "0 10px 10px 0", padding: "14px 16px",
                              }}>
                                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.85rem", letterSpacing: "0.1em", color: T.accent, marginBottom: "8px" }}>HOW THIS SHAPES YOUR TRAINING</div>
                                <div style={{ fontSize: "13px", lineHeight: 1.8, color: T.text, whiteSpace: "pre-wrap" }}>
                                  {programming || <span style={{ color: T.muted }}>▌</span>}
                                  {stillStreaming && !sixWeekGoal && <span style={{ color: T.muted }}>▌</span>}
                                </div>
                              </div>
                            )}

                            {/* 6-week goal */}
                            {(sixWeekGoal || (stillStreaming && programming)) && (
                              <div style={{
                                display: "flex", alignItems: "center", gap: "12px",
                                background: T.surface2, border: `1px solid ${T.border}`,
                                borderRadius: "10px", padding: "14px 16px",
                              }}>
                                <div style={{ fontSize: "20px", flexShrink: 0 }}>🎯</div>
                                <div>
                                  <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.8rem", letterSpacing: "0.1em", color: T.muted, marginBottom: "4px" }}>6-WEEK GOAL</div>
                                  <div style={{ fontSize: "13px", color: T.text }}>
                                    {sixWeekGoal || <span style={{ color: T.muted }}>▌</span>}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Clinical detail toggle */}
                            {(clinicalPart || (stillStreaming && sixWeekGoal)) && (
                              <div>
                                <button
                                  onClick={() => setShowClinical(p => !p)}
                                  style={{
                                    background: "none", border: `1px solid ${T.border}`,
                                    borderRadius: "6px", color: T.muted, cursor: "pointer",
                                    fontSize: "11px", letterSpacing: "0.08em", padding: "5px 14px",
                                    textTransform: "uppercase" as const, fontFamily: "'BebasNeue', sans-serif",
                                    width: "100%",
                                  }}
                                >
                                  {showClinical ? "▲ HIDE CLINICAL REPORT" : "▼ FULL CLINICAL REPORT"}
                                </button>
                                {showClinical && (
                                  <div style={{
                                    marginTop: "10px", background: T.bg,
                                    border: `1px solid ${T.border}`, borderRadius: "8px",
                                    padding: "16px", fontSize: "12px", lineHeight: 1.8,
                                    color: T.text, whiteSpace: "pre-wrap",
                                    maxHeight: "600px", overflowY: "auto",
                                    fontFamily: "ui-monospace, 'SF Mono', monospace",
                                  }}>
                                    {clinicalPart}
                                    {screenLoading && <span style={{ color: T.muted }}>▌</span>}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Post-screening discussion — appears when report is ready */}
                            {screenReport && !stillStreaming && (
                              <div style={{
                                borderTop: `1px solid ${T.border}`, paddingTop: "18px",
                                display: "flex", flexDirection: "column", gap: "12px",
                              }}>
                                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.85rem", letterSpacing: "0.1em", color: T.muted }}>
                                  WHAT DO YOU THINK?
                                </div>

                                {/* Discussion messages */}
                                {discussMsgs.length > 0 && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                                    {discussMsgs.map((m, i) => (
                                      <div key={i} style={{
                                        display: "flex", gap: "10px",
                                        flexDirection: m.role === "user" ? "row-reverse" : "row",
                                        alignItems: "flex-start",
                                      }}>
                                        {m.role === "assistant" && (
                                          <div style={{
                                            width: "28px", height: "28px", borderRadius: "50%",
                                            background: T.accent, display: "flex", alignItems: "center",
                                            justifyContent: "center", fontSize: "10px", color: T.bg,
                                            fontWeight: 700, flexShrink: 0, marginTop: "2px",
                                          }}>CF</div>
                                        )}
                                        <div style={{
                                          background: m.role === "user" ? T.accentDim : T.surface2,
                                          border: `1px solid ${m.role === "user" ? T.accent + "40" : T.border}`,
                                          borderRadius: "10px", padding: "10px 14px",
                                          fontSize: "13px", lineHeight: 1.7, color: T.text,
                                          maxWidth: "85%", whiteSpace: "pre-wrap",
                                        }}>
                                          {m.content || <span style={{ color: T.muted }}>▌</span>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}


                                {/* Quick replies */}
                                {discussMsgs.length === 0 && !planLocked && (
                                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                    <button
                                      onClick={lockPlan}
                                      style={{
                                        background: T.green + "18", border: `1px solid ${T.green}60`,
                                        borderRadius: "8px", color: T.green, cursor: "pointer",
                                        fontSize: "13px", padding: "10px 18px", fontWeight: 600,
                                      }}
                                    >
                                      Let&apos;s go!
                                    </button>
                                    <button
                                      onClick={() => { setDiscussInput("I want to discuss something — "); setTimeout(() => discussInputRef.current?.focus(), 50); }}
                                      style={{
                                        background: T.surface2, border: `1px solid ${T.border}`,
                                        borderRadius: "8px", color: T.muted, cursor: "pointer",
                                        fontSize: "13px", padding: "10px 18px",
                                      }}
                                    >
                                      I have a question
                                    </button>
                                  </div>
                                )}

                                {/* Text input */}
                                {!planLocked && (
                                  <div style={{ display: "flex", gap: "8px" }}>
                                    <input
                                      ref={discussInputRef}
                                      value={discussInput}
                                      onChange={e => setDiscussInput(e.target.value)}
                                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendDiscuss()}
                                      placeholder="Ask something, push back, or negotiate…"
                                      style={{
                                        flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                                        borderRadius: "8px", color: T.text, fontSize: "13px",
                                        padding: "10px 14px", outline: "none",
                                      }}
                                    />
                                    <button
                                      onClick={() => sendDiscuss()}
                                      disabled={!discussInput.trim() || discussStreaming}
                                      style={{
                                        background: T.accent, border: "none", borderRadius: "8px",
                                        color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                                        fontSize: "0.9rem", letterSpacing: "0.06em", padding: "10px 18px",
                                        opacity: !discussInput.trim() || discussStreaming ? 0.4 : 1,
                                      }}
                                    >
                                      SEND
                                    </button>
                                  </div>
                                )}

                                {planLocked && discussMsgs.length > 0 && !discussStreaming && (
                                  <div style={{
                                    display: "flex", alignItems: "center", gap: "8px",
                                    fontSize: "12px", color: T.green,
                                  }}>
                                    <span>✓</span>
                                    <span>Plan confirmed. Franklin has what he needs.</span>
                                  </div>
                                )}
                              </div>
                            )}

                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Past assessments */}
                  {assessments.length === 0 && !showScreening ? (
                    <p style={{ padding: "16px 20px", fontSize: "13px", color: T.muted }}>
                      No assessments yet. Click &quot;+ New Screening&quot; to run your first postural analysis.
                    </p>
                  ) : (
                    <div>
                      {assessments.map((a: any) => {
                        const isExpanded = expandedAssessment === a.id;
                        const photos: Record<string,string> = a.photos || {};
                        const photoSlots = ["right_lateral","left_lateral","anterior","posterior"];
                        const photoLabels: Record<string,string> = { right_lateral:"Right", left_lateral:"Left", anterior:"Front", posterior:"Back" };

                        // Parse coach sections from saved report
                        function extractSec(text: string, heading: string) {
                          const re = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |\\n---|\$)`);
                          const m = text?.match(re);
                          return m ? m[1].trim() : "";
                        }
                        const coachNote = extractSec(a.full_notes_md, "Coach Franklin's Assessment");
                        const implementing = extractSec(a.full_notes_md, "What We're Implementing");
                        const implItems = implementing.split(/\n(?=\d+\.)/).map((s: string) => s.replace(/^\d+\.\s*/,"").trim()).filter(Boolean);

                        return (
                          <div key={a.id} style={{ borderBottom: `1px solid ${T.border}` }}>
                            {/* Header row — always visible */}
                            <button
                              onClick={() => setExpandedAssessment(isExpanded ? null : a.id)}
                              style={{
                                width: "100%", background: "none", border: "none", cursor: "pointer",
                                padding: "16px 20px", display: "flex", justifyContent: "space-between",
                                alignItems: "center", textAlign: "left" as const,
                              }}
                            >
                              <div>
                                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.04em", color: T.text, marginBottom: "3px" }}>
                                  {a.dominant_pattern || "Postural Assessment"}
                                </div>
                                <div style={{ fontSize: "11px", color: T.muted }}>{a.assessment_date}</div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                {/* Photo thumbnails strip */}
                                {photoSlots.filter(s => photos[s]).map(s => (
                                  <img key={s} src={photos[s]} alt={photoLabels[s]}
                                    style={{ width: "28px", height: "36px", objectFit: "cover", borderRadius: "4px", border: `1px solid ${T.border}` }}
                                  />
                                ))}
                                <span style={{ fontSize: "11px", color: T.muted, marginLeft: "4px" }}>{isExpanded ? "▲" : "▼"}</span>
                              </div>
                            </button>

                            {/* Expanded content */}
                            {isExpanded && (
                              <div style={{ padding: "0 20px 20px" }}>
                                {/* Photos grid */}
                                {photoSlots.some(s => photos[s]) && (
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px", marginBottom: "16px" }}>
                                    {photoSlots.map(s => photos[s] ? (
                                      <div key={s}>
                                        <img src={photos[s]} alt={photoLabels[s]}
                                          style={{ width: "100%", aspectRatio: "3/4", objectFit: "cover", borderRadius: "8px", display: "block" }}
                                        />
                                        <div style={{ fontSize: "9px", color: T.muted, textAlign: "center", marginTop: "4px", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>
                                          {photoLabels[s]}
                                        </div>
                                      </div>
                                    ) : (
                                      <div key={s} style={{ aspectRatio: "3/4", background: T.surface2, borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <span style={{ fontSize: "9px", color: T.border }}>—</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Coach note */}
                                {coachNote && (
                                  <div style={{
                                    background: `linear-gradient(135deg, ${T.surface2} 0%, rgba(200,169,110,0.06) 100%)`,
                                    border: `1px solid rgba(200,169,110,0.2)`,
                                    borderRadius: "10px", padding: "14px 16px", marginBottom: "12px",
                                    fontSize: "13px", lineHeight: 1.8, color: T.text, whiteSpace: "pre-wrap",
                                  }}>
                                    {coachNote}
                                  </div>
                                )}

                                {/* Implementation items */}
                                {implItems.length > 0 && (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" }}>
                                    {implItems.map((item: string, i: number) => (
                                      <div key={i} style={{
                                        background: T.surface2, border: `1px solid ${T.border}`,
                                        borderRadius: "8px", padding: "10px 14px",
                                        display: "flex", gap: "12px", alignItems: "flex-start",
                                      }}>
                                        <span style={{ color: T.accent, fontFamily: "'BebasNeue', sans-serif", fontSize: "0.9rem", flexShrink: 0 }}>{i+1}</span>
                                        <span style={{ fontSize: "12px", lineHeight: 1.7, color: T.text }}>{item}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Full report toggle */}
                                {a.full_notes_md && (
                                  <details style={{ marginTop: "6px" }}>
                                    <summary style={{ fontSize: "11px", color: T.muted, cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" as const, userSelect: "none" as const }}>
                                      ▼ Full clinical report
                                    </summary>
                                    <div style={{
                                      marginTop: "10px", fontSize: "12px", color: T.text, lineHeight: 1.8,
                                      whiteSpace: "pre-wrap", fontFamily: "ui-monospace, 'SF Mono', monospace",
                                      background: T.bg, borderRadius: "6px", padding: "12px 14px",
                                      maxHeight: "400px", overflowY: "auto",
                                    }}>
                                      {a.full_notes_md}
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Card>

              </div>
            );
          })()}

          {/* NUTRITION TAB */}
          {nav === "nutrition" && (() => {
            if (nutritionLoading) return <p style={{ color: T.muted, fontSize: "13px", padding: "20px 0" }}>Loading…</p>;

            const p = nutrition;

            const FRAMEWORK_LABELS: Record<string, string> = {
              weston_price: "Weston A. Price",
              mediterranean: "Mediterranean",
              carnivore: "Carnivore",
              paleo: "Paleo",
            };

            const FLAG_LABELS: Record<string, string> = {
              omega3_gap: "Omega-3 gap (fatty fish frequency unknown)",
              vitamin_d_risk: "Vitamin D risk (northern latitude, winter)",
              protein_quantity_unknown: "Protein quantity not yet confirmed",
            };

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* Framework */}
                <Card>
                  <CardHeader left="Nutritional Framework" right={
                    p?.framework ? <Badge color={T.accent}>{FRAMEWORK_LABELS[p.framework] || p.framework}</Badge> : undefined
                  } />
                  <div style={{ padding: "16px 20px" }}>
                    {!p ? (
                      <div>
                        <p style={{ fontSize: "13px", color: T.muted, marginBottom: "10px" }}>No nutrition profile in database yet.</p>
                        <p style={{ fontSize: "12px", color: T.muted, lineHeight: 1.6 }}>
                          Run the seed SQL from <code style={{ color: T.accent, background: T.surface2, padding: "1px 5px", borderRadius: "3px" }}>supabase/migrations/001_initial_schema.sql</code> (the commented bootstrap section) to populate the initial profile.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div style={{ display: "flex", gap: "28px", flexWrap: "wrap" }}>
                          <div>
                            <Label>Goal priority</Label>
                            <span style={{ fontSize: "13px", color: p.goal_priority ? T.text : T.muted, textTransform: "capitalize" }}>
                              {p.goal_priority?.replace(/_/g, " ") || "Not set"}
                            </span>
                          </div>
                          {p.daily_protein_target_g && (
                            <div>
                              <Label>Protein target</Label>
                              <span style={{ fontSize: "13px", color: T.text }}>{p.daily_protein_target_g}g/day</span>
                            </div>
                          )}
                          {p.daily_kcal_target && (
                            <div>
                              <Label>Calorie target</Label>
                              <span style={{ fontSize: "13px", color: T.text }}>{p.daily_kcal_target} kcal/day</span>
                            </div>
                          )}
                          <div>
                            <Label>Profile date</Label>
                            <span style={{ fontSize: "13px", color: T.muted }}>{p.profile_date || "—"}</span>
                          </div>
                        </div>

                        {!p.goals_set && (
                          <div style={{ background: T.yellow + "10", border: `1px solid ${T.yellow}30`, borderRadius: "8px", padding: "10px 14px", fontSize: "12px", color: T.yellow }}>
                            Goals not yet set — goal priority conversation needed before recommendations have a direction.
                          </div>
                        )}

                        {p.notes && (
                          <p style={{ fontSize: "13px", color: T.muted, lineHeight: 1.7 }}>{p.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                </Card>

                {/* Known staples */}
                {p?.known_staples?.length > 0 && (
                  <Card>
                    <CardHeader left="Known Dietary Staples" />
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={{ background: T.surface2 }}>
                            {["Food", "Frequency", "Price Compliance"].map(h => (
                              <th key={h} style={{ padding: "8px 14px", textAlign: "left", fontSize: "9px", color: T.muted, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: `1px solid ${T.border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.known_staples.map((s: any, i: number) => {
                            const compColor = s.compliance === "excellent" ? T.green : s.compliance === "very_good" ? T.blue : T.yellow;
                            return (
                              <tr key={i} style={{ borderBottom: `1px solid ${T.border}` }}>
                                <td style={{ padding: "9px 14px", color: T.text, textTransform: "capitalize" }}>{s.food?.replace(/_/g, " ")}</td>
                                <td style={{ padding: "9px 14px", color: T.muted, textTransform: "capitalize" }}>{s.frequency}</td>
                                <td style={{ padding: "9px 14px" }}>
                                  <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "99px", background: compColor + "20", color: compColor, fontWeight: 600 }}>
                                    {s.compliance?.replace(/_/g, " ")}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {/* Flags / gaps */}
                {p?.flags && Object.keys(p.flags).some(k => p.flags[k]) && (
                  <Card>
                    <CardHeader left="Open Questions / Gaps" />
                    <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      {Object.entries(p.flags).filter(([, v]) => v).map(([key]) => (
                        <div key={key} style={{ display: "flex", gap: "10px", alignItems: "flex-start", padding: "8px 0", borderBottom: `1px solid ${T.border}` }}>
                          <span style={{ color: T.yellow, fontSize: "14px", lineHeight: 1, flexShrink: 0 }}>⚑</span>
                          <span style={{ fontSize: "13px", color: T.muted }}>{FLAG_LABELS[key] || key.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Weston Price context */}
                {p?.framework === "weston_price" && (
                  <Card>
                    <CardHeader left="Weston Price Assessment" right={<Badge color={T.green}>High Compliance</Badge>} />
                    <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      {[
                        ["Fat-soluble vitamins", "Butter + parmesan + egg yolks + liver = A/D/K2 stack. Daily consumption — not occasional.", T.green],
                        ["Animal fats", "Present and unrefined. No evidence of industrial seed oil reliance.", T.green],
                        ["Special foods", "Liver + egg yolks consumed regularly. These are Price's highest-priority foods.", T.green],
                        ["Fermented foods", "Aged hard cheese (parmesan) confirmed. Sauerkraut/kefir status unknown.", T.yellow],
                        ["Omega-3 / fatty fish", "Not confirmed. Butter and eggs provide some, but wild-caught fatty fish is the primary source. Key gap.", T.red],
                        ["Carbohydrate base", "Unknown. Highly refined carbs would be the main displacement risk.", T.yellow],
                      ].map(([label, desc, color]) => (
                        <div key={label as string} style={{ display: "flex", gap: "12px", paddingBottom: "10px", borderBottom: `1px solid ${T.border}` }}>
                          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color as string, flexShrink: 0, marginTop: "5px" }} />
                          <div>
                            <div style={{ fontSize: "12px", fontWeight: 600, marginBottom: "2px" }}>{label as string}</div>
                            <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.5 }}>{desc as string}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

              </div>
            );
          })()}
        </div>

        {/* ── CHAT PANEL (desktop sidebar) ── */}
        {chatOpen && !isMobile && ChatPanel}
      </div>

      {/* ── MOBILE CHAT (bottom panel) ── */}
      {chatOpen && isMobile && (
        <div style={{ flexShrink: 0 }}>{ChatPanel}</div>
      )}

      {/* ── MORNING CHECK-IN MODAL ── */}
      {readinessModal && (
        <div onClick={e => e.target === e.currentTarget && setReadinessModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "28px", width: "420px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
            <div>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em" }}>MORNING CHECK-IN</div>
              <p style={{ fontSize: "12px", color: T.muted, margin: "4px 0 0" }}>30 seconds. Tells Franklin what he needs to know.</p>
            </div>

            {/* Sleep */}
            <div>
              <Label>How many hours did you sleep?</Label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[4, 5, 6, 6.5, 7, 7.5, 8, 9].map(h => (
                  <button key={h} onClick={() => setCheckinSleep(h)} style={{
                    padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                    background: checkinSleep === h ? T.blue + "22" : T.surface2,
                    border: `1px solid ${checkinSleep === h ? T.blue : T.border}`,
                    color: checkinSleep === h ? T.blue : T.muted,
                    transition: "all 0.12s",
                  }}>{h}h</button>
                ))}
              </div>
            </div>

            {/* Energy */}
            <div>
              <Label>Energy level today?</Label>
              <div style={{ display: "flex", gap: "5px" }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => {
                  const color = n <= 3 ? T.red : n <= 6 ? T.yellow : T.green;
                  return (
                    <button key={n} onClick={() => setCheckinEnergy(n)} style={{
                      flex: 1, padding: "10px 4px", borderRadius: "7px", cursor: "pointer",
                      fontSize: "13px", fontWeight: 700,
                      background: checkinEnergy === n ? color + "22" : T.surface2,
                      border: `1px solid ${checkinEnergy === n ? color : T.border}`,
                      color: checkinEnergy === n ? color : T.muted,
                      transition: "all 0.12s",
                    }}>{n}</button>
                  );
                })}
              </div>
            </div>

            {/* Soreness */}
            <div>
              <Label>Any soreness or discomfort? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></Label>
              <input
                value={checkinSoreness}
                onChange={e => setCheckinSoreness(e.target.value)}
                placeholder="Lower back, right knee, general fatigue…"
                style={{
                  width: "100%", background: T.surface2, border: `1px solid ${T.border}`,
                  borderRadius: "8px", color: T.text, fontSize: "13px",
                  padding: "9px 12px", outline: "none", fontFamily: "inherit",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            {/* Cycle tracking (only shown if athlete tracks cycle) */}
            {(athleteProfile?.tracksCycle || cyclePhase) && (
              <div>
                <Label>Cycle tracking</Label>
                <button
                  onClick={logCycleStart}
                  disabled={cycleLogging}
                  style={{
                    background: cycleLogging ? T.surface2 : "rgba(248,81,73,0.1)",
                    border: `1px solid ${cycleLogging ? T.border : T.red + "60"}`,
                    borderRadius: "8px", color: cycleLogging ? T.muted : T.red,
                    cursor: cycleLogging ? "default" : "pointer",
                    fontSize: "12px", fontWeight: 600, padding: "8px 14px",
                    fontFamily: "inherit",
                  }}
                >
                  {cycleLogging ? "Logging…" : "Period started today"}
                </button>
                {cyclePhase && (
                  <p style={{ fontSize: "11px", color: T.muted, margin: "4px 0 0" }}>
                    Currently: {cyclePhase.label} (Day {cyclePhase.day})
                  </p>
                )}
              </div>
            )}

            {/* Advanced toggle (for wearable users) */}
            <div>
              <button onClick={() => setCheckinShowAdvanced(p => !p)} style={{
                background: "none", border: "none", color: T.muted, cursor: "pointer",
                fontSize: "11px", padding: 0, textDecoration: "underline", textDecorationColor: T.border,
              }}>
                {checkinShowAdvanced ? "▲ Hide" : "▼ Add"} wearable data (HRV, RHR)
              </button>
              {checkinShowAdvanced && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "12px" }}>
                  {[["HRV (ms)", "hrv_sdnn", "45"], ["Sleep (h)", "sleep_total_h", "7.5"], ["RHR (bpm)", "resting_hr", "52"]].map(([label, key, placeholder]) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <input type="number" value={(manualForm as any)[key]}
                        onChange={e => setManualForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.text, fontSize: "13px", padding: "8px 10px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setReadinessModal(false)} style={{
                background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px",
                color: T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", padding: "10px 16px",
              }}>Cancel</button>
              <button
                onClick={saveManualReadiness}
                disabled={manualSaving || (checkinSleep === null && checkinEnergy === null)}
                style={{
                  background: T.accent, border: "none", borderRadius: "8px",
                  color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                  fontSize: "1rem", letterSpacing: "0.08em", padding: "10px 24px",
                  opacity: (manualSaving || (checkinSleep === null && checkinEnergy === null)) ? 0.4 : 1,
                }}
              >
                {manualSaving ? "SAVING…" : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SESSION LOG MODAL ── */}
      {sessionLogModal && (
        <div onClick={e => e.target === e.currentTarget && setSessionLogModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 200, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "16px", overflowY: "auto" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "16px", padding: "28px", width: "500px", maxWidth: "100%", display: "flex", flexDirection: "column", gap: "20px", marginTop: "20px" }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em" }}>LOG SESSION</div>

            {/* Type */}
            <div>
              <Label>Session Type</Label>
              <div style={{ display: "flex", gap: "8px" }}>
                {[["lifting","🏋️","Lift"],["run","🏃","Run"],["jits","🥋","BJJ"],["other","📋","Other"]].map(([type, icon, label]) => (
                  <button key={type} onClick={() => setSessionLogType(type)} style={{
                    flex: 1, padding: "10px 8px", borderRadius: "8px", cursor: "pointer",
                    fontSize: "12px", fontWeight: 600, transition: "all 0.12s",
                    background: sessionLogType === type ? T.accentDim : T.surface2,
                    border: `1px solid ${sessionLogType === type ? T.accent : T.border}`,
                    color: sessionLogType === type ? T.accent : T.muted,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                  }}>
                    <span style={{ fontSize: "18px" }}>{icon}</span>
                    <span style={{ fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.06em" }}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Date + Duration */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <Label>Date</Label>
                <input type="date" value={sessionLogDate} onChange={e => setSessionLogDate(e.target.value)}
                  style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.text, fontSize: "13px", padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
              </div>
              <div>
                <Label>Duration (minutes)</Label>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {["45", "60", "75", "90"].map(d => (
                    <button key={d} onClick={() => setSessionLogDuration(d)} style={{
                      padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
                      background: sessionLogDuration === d ? T.accentDim : T.surface2,
                      border: `1px solid ${sessionLogDuration === d ? T.accent : T.border}`,
                      color: sessionLogDuration === d ? T.accent : T.muted,
                    }}>{d}</button>
                  ))}
                  <input type="number" value={sessionLogDuration} onChange={e => setSessionLogDuration(e.target.value)}
                    placeholder="min" style={{ width: "52px", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "6px", color: T.text, fontSize: "12px", padding: "6px 8px", outline: "none", fontFamily: "inherit" }} />
                </div>
              </div>
            </div>

            {/* RPE */}
            <div>
              <Label>Overall RPE</Label>
              <div style={{ display: "flex", gap: "5px" }}>
                {[1,2,3,4,5,6,7,8,9,10].map(n => {
                  const color = n <= 3 ? T.green : n <= 6 ? T.yellow : n <= 8 ? T.accent : T.red;
                  return (
                    <button key={n} onClick={() => setSessionLogRpe(n)} style={{
                      flex: 1, padding: "10px 3px", borderRadius: "7px", cursor: "pointer",
                      fontSize: "13px", fontWeight: 700,
                      background: sessionLogRpe === n ? color + "22" : T.surface2,
                      border: `1px solid ${sessionLogRpe === n ? color : T.border}`,
                      color: sessionLogRpe === n ? color : T.muted,
                    }}>{n}</button>
                  );
                })}
              </div>
            </div>

            {/* Exercises */}
            {sessionLogType === "lifting" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <Label>Key Exercises <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></Label>
                  <button onClick={() => setSessionLogExercises(p => [...p, { exercise: "", sets: "", reps: "", load_kg: "" }])} style={{
                    background: "none", border: `1px solid ${T.border}`, borderRadius: "5px",
                    color: T.muted, cursor: "pointer", fontSize: "11px", padding: "2px 8px",
                  }}>+ Add</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {sessionLogExercises.map((ex, i) => (
                    <div key={i}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 50px 60px 60px 24px", gap: "6px", alignItems: "center" }}>
                        <input
                          value={ex.exercise}
                          onChange={e => {
                            const val = e.target.value;
                            setSessionLogExercises(p => p.map((x,j) => j===i ? {...x, exercise: val} : x));
                            if (val.length >= 2) {
                              const t = setTimeout(() => fetchExHistory(val, i), 400);
                              return () => clearTimeout(t);
                            } else {
                              setExHistory(p => ({ ...p, [i]: [] }));
                            }
                          }}
                          placeholder="Deadlift"
                          style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "6px", color: T.text, fontSize: "12px", padding: "7px 10px", outline: "none", fontFamily: "inherit" }}
                        />
                        <input value={ex.sets} onChange={e => setSessionLogExercises(p => p.map((x,j) => j===i ? {...x, sets: e.target.value} : x))}
                          placeholder="4" type="number" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "6px", color: T.text, fontSize: "12px", padding: "7px 8px", outline: "none", fontFamily: "inherit" }} />
                        <input value={ex.reps} onChange={e => setSessionLogExercises(p => p.map((x,j) => j===i ? {...x, reps: e.target.value} : x))}
                          placeholder="6" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "6px", color: T.text, fontSize: "12px", padding: "7px 8px", outline: "none", fontFamily: "inherit" }} />
                        <input value={ex.load_kg} onChange={e => setSessionLogExercises(p => p.map((x,j) => j===i ? {...x, load_kg: e.target.value} : x))}
                          placeholder={wLabel} type="number" style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "6px", color: T.text, fontSize: "12px", padding: "7px 8px", outline: "none", fontFamily: "inherit" }} />
                        <button onClick={() => setSessionLogExercises(p => p.filter((_,j) => j!==i))} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "14px", padding: 0 }}>×</button>
                      </div>
                      {/* Exercise history */}
                      {exHistory[i]?.length > 0 && (
                        <div style={{ paddingLeft: "6px", marginTop: "4px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {exHistory[i].slice(0, 4).map((h, hi) => (
                            <span key={hi} style={{ fontSize: "10px", color: T.muted, background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "4px", padding: "2px 7px" }}>
                              {h.date.slice(5)} — {h.sets}×{h.reps}{h.load_kg ? ` @ ${formatWeight(h.load_kg, unitSystem)}` : ""}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ fontSize: "10px", color: T.muted, marginTop: "2px" }}>Exercise · Sets · Reps · Weight (kg) — history shows below as you type</div>
                </div>
              </div>
            )}

            {/* Shoulder status */}
            <div>
              <Label>Shoulder</Label>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {[["no_issues","✓ No issues",T.green],["minor","Minor",T.yellow],["moderate","Moderate",T.accent],["significant","Significant",T.red]].map(([val, label, color]) => (
                  <button key={val} onClick={() => setSessionLogShoulder(val as string)} style={{
                    padding: "6px 12px", borderRadius: "6px", cursor: "pointer", fontSize: "12px",
                    background: sessionLogShoulder === val ? (color as string) + "18" : T.surface2,
                    border: `1px solid ${sessionLogShoulder === val ? color as string : T.border}`,
                    color: sessionLogShoulder === val ? color as string : T.muted,
                  }}>{label}</button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label>Notes <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></Label>
              <input value={sessionLogNotes} onChange={e => setSessionLogNotes(e.target.value)}
                placeholder="How it went, what felt strong, what didn't…"
                style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.text, fontSize: "13px", padding: "9px 12px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button onClick={() => setSessionLogModal(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", padding: "10px 16px" }}>
                Cancel
              </button>
              <button onClick={saveSessionLog} disabled={sessionLogSaving || !sessionLogRpe} style={{
                background: T.accent, border: "none", borderRadius: "8px",
                color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                fontSize: "1rem", letterSpacing: "0.08em", padding: "10px 28px",
                opacity: sessionLogSaving || !sessionLogRpe ? 0.4 : 1,
              }}>
                {sessionLogSaving ? "SAVING…" : "SAVE SESSION"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── GOAL PIVOT MODAL ── */}
      {pivotModal && (
        <div onClick={e => e.target === e.currentTarget && setPivotModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "16px", width: "500px", maxWidth: "100%", display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "90vh" }}>

            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.2rem", letterSpacing: "0.06em", color: T.accent }}>CHANGE FOCUS</div>
                <div style={{ fontSize: "11px", color: T.muted }}>Tell Franklin what you want to change. He&apos;ll build you a new program.</div>
              </div>
              <button onClick={() => setPivotModal(false)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "20px", padding: "4px" }}>×</button>
            </div>

            {/* Chat */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px", minHeight: "260px" }}>
              {pivotMsgs.map((m, i) => (
                <div key={i} style={{ display: "flex", gap: "10px", flexDirection: m.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
                  {m.role === "assistant" && (
                    <div style={{ width: "26px", height: "26px", borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: T.bg, fontWeight: 700, flexShrink: 0 }}>CF</div>
                  )}
                  <div style={{
                    background: m.role === "user" ? T.accentDim : T.surface2,
                    border: `1px solid ${m.role === "user" ? T.accent + "40" : T.border}`,
                    borderRadius: "10px", padding: "10px 14px",
                    fontSize: "13px", lineHeight: 1.75, color: T.text,
                    maxWidth: "88%", whiteSpace: "pre-wrap",
                  }}>
                    {m.content || <span style={{ color: T.muted }}>▌</span>}
                  </div>
                </div>
              ))}
              <div ref={pivotEndRef} />
            </div>

            {/* Confirm new direction or chat */}
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${T.border}`, flexShrink: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {pivotReady && pivotData ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: "10px", padding: "12px 16px" }}>
                    <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: T.accent, marginBottom: "4px" }}>NEW DIRECTION</div>
                    <div style={{ fontSize: "13px", color: T.text }}>{pivotData.new_goal}</div>
                  </div>
                  <button
                    onClick={confirmPivot}
                    disabled={pivotConfirming}
                    style={{
                      background: pivotConfirming ? T.surface2 : T.accent,
                      border: "none", borderRadius: "10px",
                      color: pivotConfirming ? T.muted : T.bg,
                      cursor: pivotConfirming ? "default" : "pointer",
                      fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                      letterSpacing: "0.08em", padding: "13px",
                    }}
                  >
                    {pivotConfirming ? "BUILDING NEW PROGRAM…" : "CONFIRM — BUILD NEW PROGRAM →"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    value={pivotInput}
                    onChange={e => setPivotInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.shiftKey && pivotInput.trim() && !pivotStreaming) {
                        const msg = pivotInput.trim();
                        setPivotInput("");
                        streamPivot(msg);
                      }
                    }}
                    placeholder={pivotStreaming ? "Franklin is thinking…" : "Tell him what you want to change…"}
                    disabled={pivotStreaming}
                    style={{
                      flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                      borderRadius: "8px", color: T.text, fontSize: "13px",
                      padding: "10px 14px", outline: "none", fontFamily: "inherit",
                      opacity: pivotStreaming ? 0.5 : 1,
                    }}
                  />
                  <button
                    onClick={() => { if (pivotInput.trim() && !pivotStreaming) { const msg = pivotInput.trim(); setPivotInput(""); streamPivot(msg); } }}
                    disabled={!pivotInput.trim() || pivotStreaming}
                    style={{
                      background: T.accent, border: "none", borderRadius: "8px",
                      color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                      fontSize: "0.9rem", letterSpacing: "0.06em", padding: "10px 18px",
                      opacity: !pivotInput.trim() || pivotStreaming ? 0.4 : 1,
                    }}
                  >
                    SEND
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PR NOTIFICATION TOAST ── */}
      {prNotification && prNotification.length > 0 && (
        <div style={{
          position: "fixed", bottom: "24px", right: "24px",
          background: T.surface, border: `1px solid ${T.accent}`,
          borderRadius: "12px", padding: "16px 20px", zIndex: 300,
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)", maxWidth: "320px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.06em", color: T.accent }}>
              NEW PR
            </div>
            <button onClick={() => setPrNotification(null)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "18px", lineHeight: 1 }}>×</button>
          </div>
          {prNotification.map((pr, i) => (
            <div key={i} style={{ marginBottom: i < prNotification.length - 1 ? "8px" : 0 }}>
              <div style={{ fontSize: "13px", color: T.text, fontWeight: 600 }}>{pr.exercise}</div>
              <div style={{ fontSize: "12px", color: T.muted, marginTop: "2px" }}>
                {pr.weight}kg × {pr.reps} reps
                <span style={{ color: T.green, marginLeft: "8px" }}>
                  +{(pr.weight - pr.previous_best).toFixed(1)}kg from prev best {pr.previous_best}kg
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PROGRAM REVEAL MODAL ── */}
      {revealModal && (
        <div
          onClick={e => e.target === e.currentTarget && setRevealModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 250, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
        >
          <div style={{
            background: T.surface, width: "100%", maxWidth: "680px",
            borderRadius: "16px 16px 0 0", maxHeight: "82vh",
            display: "flex", flexDirection: "column",
            border: `1px solid ${T.border}`, borderBottom: "none",
          }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.06em", color: T.accent }}>
                  COACH FRANKLIN — PROGRAM REVIEW
                </div>
                <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
                  Franklin walks you through the new block. Push back, ask questions, or green-light it.
                </div>
              </div>
              <button onClick={() => setRevealModal(false)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "22px", padding: "0 0 0 12px", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              {revealMsgs.map((m, i) => (
                <div key={i} style={{
                  padding: "12px 16px", borderRadius: "10px", fontSize: "13px", lineHeight: 1.75,
                  background: m.role === "user" ? T.accentDim : T.surface2,
                  border: `1px solid ${m.role === "user" ? T.accent + "33" : T.border}`,
                  color: T.text, whiteSpace: "pre-wrap",
                  alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "90%",
                }}>
                  {m.content || (revealStreaming && i === revealMsgs.length - 1 ? <span style={{ color: T.muted }}>▌</span> : "")}
                </div>
              ))}
              <div ref={revealEndRef} />
            </div>
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${T.border}`, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                <input
                  value={revealInput}
                  onChange={e => setRevealInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey && revealInput.trim() && !revealStreaming) {
                      const msg = revealInput; setRevealInput(""); streamReveal(msg);
                    }
                  }}
                  placeholder="Ask a question or push back on a decision…"
                  disabled={revealStreaming}
                  style={{
                    flex: 1, background: T.surface2, border: `1px solid ${T.border}`,
                    borderRadius: "8px", color: T.text, fontSize: "13px",
                    padding: "9px 12px", outline: "none", fontFamily: "inherit",
                  }}
                />
                <button
                  onClick={() => { const msg = revealInput; setRevealInput(""); streamReveal(msg); }}
                  disabled={revealStreaming || !revealInput.trim()}
                  style={{
                    background: T.accent, border: "none", borderRadius: "8px",
                    color: T.bg, cursor: "pointer", fontWeight: 700,
                    padding: "9px 14px", fontFamily: "'BebasNeue', sans-serif",
                    letterSpacing: "0.06em", fontSize: "0.85rem",
                    opacity: (revealStreaming || !revealInput.trim()) ? 0.5 : 1,
                  }}
                >→</button>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {["Looks good — let's go", "Why this phase?", "Change a session"].map(q => (
                  <button key={q} onClick={() => { setRevealInput(""); streamReveal(q); }} disabled={revealStreaming} style={{
                    background: T.surface2, border: `1px solid ${T.border}`,
                    borderRadius: "6px", color: T.muted, cursor: "pointer",
                    fontSize: "11px", padding: "5px 10px", fontFamily: "inherit",
                    opacity: revealStreaming ? 0.5 : 1,
                  }}>{q}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── EXERCISE TUTORIAL MODAL ── */}
      {tutorialModal && (
        <div
          onClick={e => e.target === e.currentTarget && setTutorialModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
        >
          <div style={{
            background: T.surface, borderRadius: "14px", width: "100%", maxWidth: "400px",
            border: `1px solid ${T.border}`, overflow: "hidden", maxHeight: "90vh", display: "flex", flexDirection: "column",
          }}>
            <div style={{ padding: "14px 18px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.04em", color: T.text, textTransform: "capitalize" }}>
                {tutorialModal.name}
              </div>
              <button onClick={() => setTutorialModal(null)} style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "20px", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "16px", overflowY: "auto", flex: 1 }}>
              {tutorialModal.loading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: T.muted, fontSize: "13px" }}>
                  Loading tutorial…
                </div>
              ) : tutorialModal.data?.gif_url ? (
                <>
                  <img
                    src={tutorialModal.data.gif_url}
                    alt={tutorialModal.name}
                    style={{ width: "100%", borderRadius: "8px", marginBottom: "12px", display: "block" }}
                  />
                  {tutorialModal.data.target && (
                    <div style={{ fontSize: "11px", color: T.muted, marginBottom: "10px" }}>
                      <span style={{ color: T.accent, fontWeight: 600 }}>Target: </span>
                      {tutorialModal.data.target}
                      {tutorialModal.data.body_part && ` · ${tutorialModal.data.body_part}`}
                      {tutorialModal.data.equipment && ` · ${tutorialModal.data.equipment}`}
                    </div>
                  )}
                  {tutorialModal.data.instructions?.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {tutorialModal.data.instructions.slice(0, 5).map((step: string, i: number) => (
                        <div key={i} style={{ display: "flex", gap: "8px", fontSize: "12px", color: T.text, lineHeight: 1.6 }}>
                          <span style={{ color: T.accent, fontWeight: 700, flexShrink: 0, fontFamily: "'BebasNeue', sans-serif" }}>{i + 1}.</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <div style={{ fontSize: "32px", marginBottom: "10px" }}>🎬</div>
                  <p style={{ color: T.muted, fontSize: "13px", lineHeight: 1.6, maxWidth: "260px", margin: "0 auto" }}>
                    No GIF found for <strong style={{ color: T.text }}>{tutorialModal.name}</strong>. Watch a tutorial on YouTube instead.
                  </p>
                </div>
              )}
              {tutorialModal.data?.youtube_url && (
                <a
                  href={tutorialModal.data.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block", textAlign: "center",
                    background: "rgba(255,0,0,0.1)", border: "1px solid rgba(255,60,60,0.35)",
                    borderRadius: "8px", color: "#ff4444", textDecoration: "none",
                    fontSize: "12px", fontWeight: 600, padding: "10px",
                    marginTop: "14px", letterSpacing: "0.04em",
                  }}
                >
                  ▶ Watch on YouTube
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RESCHEDULE MODAL ── */}
      {rescheduleId && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 200,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "24px",
        }} onClick={() => setRescheduleId(null)}>
          <div style={{
            background: T.surface, borderRadius: "16px", padding: "24px",
            width: "100%", maxWidth: "340px", display: "flex", flexDirection: "column", gap: "16px",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem", letterSpacing: "0.06em" }}>
              Move Session
            </div>
            <p style={{ fontSize: "13px", color: T.muted, margin: 0, lineHeight: 1.6 }}>
              Pick a new date. The session will move and your calendar feed will update automatically.
            </p>
            <input
              type="date"
              value={rescheduleDate}
              onChange={e => setRescheduleDate(e.target.value)}
              min={data?.today}
              style={{
                background: T.bg, border: `1px solid ${T.border}`, borderRadius: "8px",
                color: T.text, fontSize: "15px", padding: "10px 14px", outline: "none",
                fontFamily: "inherit", width: "100%", boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setRescheduleId(null)}
                style={{
                  flex: 1, padding: "11px", borderRadius: "8px", cursor: "pointer",
                  background: "transparent", border: `1px solid ${T.border}`, color: T.muted, fontSize: "13px",
                }}
              >Cancel</button>
              <button
                onClick={rescheduleSession}
                disabled={!rescheduleDate}
                style={{
                  flex: 2, padding: "11px", borderRadius: "8px", cursor: "pointer",
                  background: T.accent, border: "none", color: T.bg,
                  fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.06em",
                  opacity: rescheduleDate ? 1 : 0.4,
                }}
              >CONFIRM MOVE</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MARK DONE MODAL ── */}
      {doneModal && (() => {
        const isFoundation = data?.block && (
          data.block.name?.toLowerCase().includes("foundation") || (data.block.week && data.block.week <= 4)
        );
        const likedTags = ["Volume felt right", "Good exercise selection", "Felt challenged", "Good pacing", "Energy was high", "Enjoyed the session"];
        const dislikedTags = ["Too much volume", "Too easy", "Too hard", "Wrong exercises", "Took too long", "Low energy", "Something hurt"];
        const toggleTag = (tag: string, set: Set<string>, setter: (s: Set<string>) => void) => {
          const next = new Set(set);
          next.has(tag) ? next.delete(tag) : next.add(tag);
          setter(next);
        };
        return (
          <div onClick={e => e.target === e.currentTarget && setDoneModal(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
            <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "14px", padding: "28px", width: "480px", maxWidth: "100%", maxHeight: "90dvh", overflowY: "auto" }}>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.6rem", letterSpacing: "0.04em", marginBottom: "4px" }}>SESSION DONE</div>
              {isFoundation && (
                <p style={{ fontSize: "12px", color: T.accent, marginBottom: "20px", letterSpacing: "0.04em" }}>
                  FOUNDATION WEEK — your feedback shapes the program
                </p>
              )}

              {/* RPE */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "10px" }}>How hard was it? (RPE)</p>
                <div style={{ display: "flex", gap: "6px" }}>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => (
                    <button key={n} onClick={() => setDoneFeedbackRpe(n === doneFeedbackRpe ? null : n)}
                      style={{
                        flex: 1, padding: "8px 0", borderRadius: "6px", border: "none", cursor: "pointer", fontSize: "13px", fontWeight: 600,
                        background: doneFeedbackRpe === n ? T.accent : T.surface2,
                        color: doneFeedbackRpe === n ? T.bg : n >= 8 ? "#f85149" : n >= 5 ? T.text : T.muted,
                      }}>{n}</button>
                  ))}
                </div>
              </div>

              {/* Energy */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "10px" }}>Energy level</p>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["Low", "Medium", "High"] as const).map(e => (
                    <button key={e} onClick={() => setDoneFeedbackEnergy(doneFeedbackEnergy === e.toLowerCase() ? null : e.toLowerCase())}
                      style={{
                        flex: 1, padding: "9px", borderRadius: "8px", border: `1px solid ${T.border}`, cursor: "pointer", fontSize: "13px",
                        background: doneFeedbackEnergy === e.toLowerCase() ? T.accentDim : "transparent",
                        color: doneFeedbackEnergy === e.toLowerCase() ? T.accent : T.muted,
                      }}>{e}</button>
                  ))}
                </div>
              </div>

              {isFoundation && (
                <>
                  {/* Liked */}
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "10px" }}>What worked</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {likedTags.map(tag => (
                        <button key={tag} onClick={() => toggleTag(tag, doneFeedbackLiked, setDoneFeedbackLiked)}
                          style={{
                            padding: "6px 12px", borderRadius: "20px", border: `1px solid ${doneFeedbackLiked.has(tag) ? T.accent : T.border}`,
                            background: doneFeedbackLiked.has(tag) ? T.accentDim : "transparent",
                            color: doneFeedbackLiked.has(tag) ? T.accent : T.muted,
                            cursor: "pointer", fontSize: "12px",
                          }}>{tag}</button>
                      ))}
                    </div>
                  </div>

                  {/* Disliked */}
                  <div style={{ marginBottom: "16px" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "10px" }}>What didn't work</p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                      {dislikedTags.map(tag => (
                        <button key={tag} onClick={() => toggleTag(tag, doneFeedbackDisliked, setDoneFeedbackDisliked)}
                          style={{
                            padding: "6px 12px", borderRadius: "20px", border: `1px solid ${doneFeedbackDisliked.has(tag) ? "#f85149" : T.border}`,
                            background: doneFeedbackDisliked.has(tag) ? "rgba(248,81,73,0.1)" : "transparent",
                            color: doneFeedbackDisliked.has(tag) ? "#f85149" : T.muted,
                            cursor: "pointer", fontSize: "12px",
                          }}>{tag}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div style={{ marginBottom: "20px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "8px" }}>Notes (optional)</p>
                <textarea
                  value={doneNotes}
                  onChange={e => setDoneNotes(e.target.value)}
                  placeholder={isFoundation ? "Anything else Franklin should know about this session..." : "How it went, load, anything..."}
                  rows={2}
                  style={{ width: "100%", background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "8px", color: T.text, fontFamily: "inherit", fontSize: "13px", padding: "10px 12px", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                <button onClick={() => setDoneModal(false)} style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: "8px", color: T.muted, cursor: "pointer", fontFamily: "inherit", fontSize: "13px", padding: "9px 16px" }}>
                  Cancel
                </button>
                <button onClick={markDone} style={{ background: T.accent, border: "none", borderRadius: "8px", color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", fontWeight: 700, padding: "9px 24px", letterSpacing: "0.06em" }}>
                  CONFIRM
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── MOBILE BOTTOM TAB BAR ── */}
      {isMobile && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0,
          background: T.surface, borderTop: `1px solid ${T.border}`,
          display: "flex", zIndex: 100,
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}>
          {([
            ["today", "TODAY", "🏠"],
            ["program", "PROGRAM", "📋"],
            ["history", "HISTORY", "📊"],
            ["assessment", "ASSESS", "📸"],
            ["nutrition", "NUTRITION", "🥗"],
          ] as [NavItem, string, string][]).map(([id, label, icon]) => (
            <button
              key={id}
              onClick={() => setNav(id)}
              style={{
                flex: 1, border: "none", background: "transparent",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "10px 4px 8px",
                cursor: "pointer",
                color: nav === id ? T.accent : T.muted,
                borderTop: nav === id ? `2px solid ${T.accent}` : "2px solid transparent",
              }}
            >
              <span style={{ fontSize: "18px", lineHeight: 1 }}>{icon}</span>
              <span style={{
                fontSize: "9px", fontFamily: "'BebasNeue', sans-serif",
                letterSpacing: "0.08em", marginTop: "3px",
              }}>
                {label}
              </span>
            </button>
          ))}
          <button
            onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); }}
            style={{
              flex: 1, border: "none", background: "transparent",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", padding: "10px 4px 8px",
              cursor: "pointer", color: T.muted, borderTop: "2px solid transparent",
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1 }}>↩</span>
            <span style={{ fontSize: "9px", fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.08em", marginTop: "3px" }}>
              EXIT
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
