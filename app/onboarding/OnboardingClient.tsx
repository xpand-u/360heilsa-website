"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// ─── Design tokens (match dashboard) ─────────────────────────────────────────
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

type Step = "intro" | "intake" | "schedule" | "movement" | "foundation" | "done";

// ─── Movement tests definition ────────────────────────────────────────────────
const MOVEMENT_TESTS = [
  {
    id: "overhead_squat",
    name: "Overhead Squat",
    why: "This single movement tells me about your ankles, hips, thoracic spine, and shoulders simultaneously. It's the most efficient test I have.",
    setup: "Stand with feet shoulder-width apart. Raise both arms straight overhead. Squat as deep as comfortably possible. Do 3 slow reps.",
    film: true,
    questions: [
      { id: "arms_fall", label: "Did your arms fall forward?", options: ["Noticeably", "Slightly", "No"] },
      { id: "heels_rise", label: "Did your heels rise off the floor?", options: ["Yes", "Slightly", "No"] },
      { id: "knees_cave", label: "Did your knees cave inward?", options: ["Both", "Left only", "Right only", "No"] },
      { id: "depth", label: "How deep could you squat?", options: ["Below parallel", "Parallel", "Above parallel"] },
    ],
  },
  {
    id: "aslr",
    name: "Active Straight Leg Raise",
    why: "Shows me your hamstring length and, more importantly, whether your pelvis can stay stable while one leg moves. Asymmetry here is common and programmable.",
    setup: "Lie flat on your back, legs straight. Keep one leg completely flat. Raise the other leg as high as you can while keeping it straight. Repeat both sides.",
    film: false,
    questions: [
      { id: "right_height", label: "Right leg — how high?", options: ["Past 90°", "Around 70°", "Below 60°"] },
      { id: "left_height", label: "Left leg — how high?", options: ["Past 90°", "Around 70°", "Below 60°"] },
      { id: "flat_leg_stays", label: "Did the flat leg stay down?", options: ["Both sides yes", "One side lifted", "Both sides lifted"] },
    ],
  },
  {
    id: "ankle_dorsiflexion",
    name: "Ankle Mobility Test",
    why: "Limited ankle mobility is one of the most common reasons squat depth fails, knees compensate, and runners develop downstream issues. Takes 2 minutes to screen.",
    setup: "Stand facing a wall. Place your big toe about 10cm from the wall. Drive your knee forward to touch the wall without lifting your heel. Move further back until you find your limit. Test both ankles.",
    film: false,
    questions: [
      { id: "right_ankle", label: "Right ankle — could you touch the wall at 10cm?", options: ["Yes, easily", "Yes, barely", "No, had to move closer"] },
      { id: "left_ankle", label: "Left ankle — could you touch the wall at 10cm?", options: ["Yes, easily", "Yes, barely", "No, had to move closer"] },
      { id: "asymmetry", label: "Was there a noticeable difference side to side?", options: ["Yes, significant", "Slightly", "No, felt even"] },
    ],
  },
  {
    id: "wall_angels",
    name: "Wall Angels",
    why: "Tells me about your thoracic extension and shoulder mobility — both critical for overhead pressing, posture under load, and injury prevention in the upper body.",
    setup: "Stand with your back flat against a wall, feet 6 inches out. Place your arms in a goalpost position against the wall. Slowly slide your arms up overhead and back down, keeping everything touching the wall.",
    film: false,
    questions: [
      { id: "arms_stay", label: "Could you keep your arms on the wall throughout?", options: ["Yes, full range", "Partially — lost contact at the top", "No — lost contact early"] },
      { id: "back_stays", label: "Did your lower back stay against the wall?", options: ["Yes", "It arched slightly", "It arched significantly"] },
    ],
  },
  {
    id: "thomas_test",
    name: "Hip Flexor Test",
    why: "Tight hip flexors affect your squat, your running gait, your posture, and your lower back. This is extremely common in anyone who sits during the day.",
    setup: "Sit on the edge of a bed or firm couch. Lie back while pulling both knees to your chest. Let one leg lower toward the floor while keeping the other held to your chest. Observe what happens. Test both sides.",
    film: false,
    questions: [
      { id: "right_hip", label: "Right leg — does it hang flat or stay elevated?", options: ["Hangs flat", "Slightly elevated", "Significantly elevated"] },
      { id: "left_hip", label: "Left leg — does it hang flat or stay elevated?", options: ["Hangs flat", "Slightly elevated", "Significantly elevated"] },
      { id: "knee_flexion", label: "Does the hanging leg's knee straighten or stay bent?", options: ["Stays at ~90°", "Knee straightens noticeably", "Knee straightens fully"] },
    ],
  },
];

// ─── SVG Animations ───────────────────────────────────────────────────────────

function OverheadSquatAnim() {
  return (
    <svg viewBox="0 0 120 180" width="120" height="180" style={{ display: "block" }}>
      <style>{`
        @keyframes squat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(18px); }
        }
        @keyframes kneesBend {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(28deg); }
        }
        @keyframes armsUp {
          0%, 100% { transform: rotate(-15deg); }
          50% { transform: rotate(-5deg); }
        }
        .squat-body { animation: squat 2.5s ease-in-out infinite; transform-origin: 60px 90px; }
        .squat-leg-r { animation: kneesBend 2.5s ease-in-out infinite; transform-origin: 66px 118px; }
        .squat-leg-l { animation: kneesBend 2.5s ease-in-out infinite; transform-origin: 54px 118px; }
        .squat-arm-r { animation: armsUp 2.5s ease-in-out infinite; transform-origin: 70px 80px; }
        .squat-arm-l { animation: armsUp 2.5s ease-in-out infinite; transform-origin: 50px 80px; }
      `}</style>
      <g className="squat-body">
        {/* Head */}
        <circle cx="60" cy="38" r="12" fill="none" stroke={T.accent} strokeWidth="2" />
        {/* Torso */}
        <line x1="60" y1="50" x2="60" y2="100" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" />
        {/* Shoulders */}
        <line x1="60" y1="62" x2="72" y2="72" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        <line x1="60" y1="62" x2="48" y2="72" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        {/* Arms up */}
        <g className="squat-arm-r">
          <line x1="72" y1="72" x2="84" y2="44" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="squat-arm-l">
          <line x1="48" y1="72" x2="36" y2="44" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        </g>
        {/* Hips */}
        <line x1="52" y1="100" x2="68" y2="100" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        {/* Legs */}
        <g className="squat-leg-r">
          <line x1="66" y1="100" x2="72" y2="130" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
          <line x1="72" y1="130" x2="68" y2="158" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        </g>
        <g className="squat-leg-l">
          <line x1="54" y1="100" x2="48" y2="130" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
          <line x1="48" y1="130" x2="52" y2="158" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        </g>
        {/* Feet */}
        <line x1="68" y1="158" x2="78" y2="158" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
        <line x1="42" y1="158" x2="52" y2="158" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function ASLRAnim() {
  return (
    <svg viewBox="0 0 200 100" width="200" height="100" style={{ display: "block" }}>
      <style>{`
        @keyframes legRaise {
          0%, 100% { transform: rotate(0deg); }
          40%, 60% { transform: rotate(-65deg); }
        }
        .aslr-leg { animation: legRaise 3s ease-in-out infinite; transform-origin: 100px 58px; }
      `}</style>
      {/* Ground */}
      <line x1="20" y1="72" x2="180" y2="72" stroke={T.border2} strokeWidth="1" />
      {/* Body lying flat */}
      {/* Head */}
      <circle cx="28" cy="56" r="10" fill="none" stroke={T.accent} strokeWidth="2" />
      {/* Torso */}
      <line x1="38" y1="58" x2="100" y2="58" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" />
      {/* Static leg */}
      <line x1="100" y1="58" x2="165" y2="58" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      <line x1="165" y1="58" x2="175" y2="66" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      {/* Raising leg */}
      <g className="aslr-leg">
        <line x1="100" y1="58" x2="155" y2="58" stroke={T.text} strokeWidth="2" strokeLinecap="round" />
        <line x1="155" y1="58" x2="163" y2="66" stroke={T.text} strokeWidth="2" strokeLinecap="round" />
      </g>
    </svg>
  );
}

function AnkleAnim() {
  return (
    <svg viewBox="0 0 120 160" width="120" height="160" style={{ display: "block" }}>
      <style>{`
        @keyframes kneeForward {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(8px); }
        }
        .ankle-knee { animation: kneeForward 2s ease-in-out infinite; transform-origin: 55px 90px; }
      `}</style>
      {/* Wall */}
      <rect x="85" y="10" width="8" height="150" fill={T.surface2} stroke={T.border} strokeWidth="1" />
      {/* Foot on floor */}
      <line x1="30" y1="150" x2="75" y2="150" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      {/* Lower leg */}
      <line x1="40" y1="150" x2="55" y2="100" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" />
      {/* Knee driving forward */}
      <g className="ankle-knee">
        <circle cx="55" cy="95" r="5" fill="none" stroke={T.text} strokeWidth="2" />
        {/* Upper leg */}
        <line x1="55" y1="95" x2="62" y2="55" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {/* Head/torso simplified */}
      <circle cx="65" cy="38" r="10" fill="none" stroke={T.accent} strokeWidth="2" />
      <line x1="65" y1="48" x2="62" y2="60" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      {/* Target indicator */}
      <text x="88" y="145" fontSize="8" fill={T.muted}>wall</text>
    </svg>
  );
}

function WallAngelsAnim() {
  return (
    <svg viewBox="0 0 140 200" width="140" height="200" style={{ display: "block" }}>
      <style>{`
        @keyframes armSlide {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-45deg); }
        }
        .wa-arm-r { animation: armSlide 2.5s ease-in-out infinite; transform-origin: 78px 90px; }
        .wa-arm-l { animation: armSlide 2.5s ease-in-out infinite; transform-origin: 62px 90px; }
      `}</style>
      {/* Wall */}
      <rect x="100" y="10" width="8" height="185" fill={T.surface2} stroke={T.border} strokeWidth="1" />
      {/* Person against wall */}
      <circle cx="72" cy="48" r="12" fill="none" stroke={T.accent} strokeWidth="2" />
      {/* Torso */}
      <line x1="72" y1="60" x2="72" y2="120" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" />
      {/* Right arm — goalpost then up */}
      <g className="wa-arm-r">
        <line x1="78" y1="80" x2="100" y2="80" stroke={T.text} strokeWidth="2" strokeLinecap="round" />
        <line x1="100" y1="80" x2="100" y2="60" stroke={T.text} strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Left arm */}
      <g className="wa-arm-l" style={{ transform: "scaleX(-1)", transformOrigin: "62px 90px" }}>
        <line x1="62" y1="80" x2="40" y2="80" stroke={T.text} strokeWidth="2" strokeLinecap="round" />
        <line x1="40" y1="80" x2="40" y2="60" stroke={T.text} strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Legs */}
      <line x1="72" y1="120" x2="65" y2="170" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      <line x1="72" y1="120" x2="79" y2="170" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      <text x="104" y="145" fontSize="8" fill={T.muted}>wall</text>
    </svg>
  );
}

function ThomasTestAnim() {
  return (
    <svg viewBox="0 0 220 120" width="220" height="120" style={{ display: "block" }}>
      <style>{`
        @keyframes hipHang {
          0%, 100% { transform: rotate(5deg); }
          50% { transform: rotate(18deg); }
        }
        .thomas-hang { animation: hipHang 3s ease-in-out infinite; transform-origin: 120px 68px; }
      `}</style>
      {/* Table/bed edge */}
      <rect x="80" y="68" width="100" height="8" fill={T.surface2} stroke={T.border} strokeWidth="1" />
      {/* Person lying on table - upper body */}
      <circle cx="60" cy="52" r="10" fill="none" stroke={T.accent} strokeWidth="2" />
      <line x1="70" y1="56" x2="130" y2="62" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round" />
      {/* Knee pulled to chest */}
      <line x1="90" y1="64" x2="75" y2="44" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      <line x1="75" y1="44" x2="68" y2="32" stroke={T.accent} strokeWidth="2" strokeLinecap="round" />
      {/* Hanging leg with animation */}
      <g className="thomas-hang">
        <line x1="120" y1="68" x2="148" y2="100" stroke={T.text} strokeWidth="2.5" strokeLinecap="round" />
        <line x1="148" y1="100" x2="160" y2="96" stroke={T.text} strokeWidth="2" strokeLinecap="round" />
      </g>
      {/* Arrow indicating hanging direction */}
      <text x="158" y="115" fontSize="8" fill={T.muted}>hangs here</text>
    </svg>
  );
}

const TEST_ANIMATIONS: Record<string, React.ReactNode> = {
  overhead_squat:      <OverheadSquatAnim />,
  aslr:               <ASLRAnim />,
  ankle_dorsiflexion: <AnkleAnim />,
  wall_angels:        <WallAngelsAnim />,
  thomas_test:        <ThomasTestAnim />,
};

// ─── Schedule Days ─────────────────────────────────────────────────────────────
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const SESSION_TYPES = ["lifting", "run", "jits", "other"] as const;
const SESSION_TYPE_LABELS: Record<string, string> = {
  lifting: "Lift", run: "Run", jits: "BJJ", other: "Other",
};
const TIME_OPTIONS = ["morning", "afternoon", "evening"] as const;
const TIME_LABELS: Record<string, string> = {
  morning: "Morning (7am)", afternoon: "Afternoon (12pm)", evening: "Evening (6pm)",
};

// ─── Main Onboarding Client ───────────────────────────────────────────────────
export default function OnboardingClient() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [isMobile, setIsMobile] = useState(false);

  // Intake state
  const [intakeMsgs, setIntakeMsgs] = useState<{ role: string; content: string }[]>([]);
  const [intakeInput, setIntakeInput] = useState("");
  const [intakeStreaming, setIntakeStreaming] = useState(false);
  const [intakeComplete, setIntakeComplete] = useState(false);
  const [intakeSummary, setIntakeSummary] = useState("");
  const intakeEndRef = useRef<HTMLDivElement>(null);
  const intakeStarted = useRef(false);

  // Schedule state
  const [scheduleDays, setScheduleDays] = useState<{ day: string; type: string; time: string }[]>([]);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarLinked, setCalendarLinked] = useState(false);

  // Movement state
  const [movementIdx, setMovementIdx] = useState(0);
  const [movementAnswers, setMovementAnswers] = useState<Record<string, Record<string, string>>>({});

  // Saving
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 600);
    // Check if already onboarded
    fetch("/api/onboarding/status")
      .then(r => r.json())
      .then(d => { if (d.onboarding_complete) router.push("/dashboard"); });
  }, [router]);

  useEffect(() => {
    if (step === "intake" && !intakeStarted.current) {
      intakeStarted.current = true;
      streamIntake(null);
    }
  }, [step]);

  useEffect(() => {
    intakeEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [intakeMsgs]);

  // ── Intake streaming ────────────────────────────────────────────────────────
  async function streamIntake(userMsg: string | null) {
    setIntakeStreaming(true);
    const newHistory = userMsg
      ? [...intakeMsgs, { role: "user", content: userMsg }]
      : intakeMsgs;
    if (userMsg) setIntakeMsgs([...newHistory, { role: "assistant", content: "" }]);
    else setIntakeMsgs([{ role: "assistant", content: "" }]);

    let buf = "";
    let parsedIntakeData: Record<string, unknown> | null = null;
    try {
      const res = await fetch("/api/onboarding/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: userMsg ? newHistory.slice(0, -1) : [],
          message: userMsg || "",
        }),
      });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Strip hidden tokens from visible text
        const visibleText = buf
          .replace(/\[INTAKE_DATA\][\s\S]*?\[\/INTAKE_DATA\]/g, "")
          .replace("[INTAKE_COMPLETE]", "")
          .trim();
        setIntakeMsgs(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: visibleText };
          return updated;
        });
      }
      // Parse structured intake data
      const dataMatch = buf.match(/\[INTAKE_DATA\]([\s\S]*?)\[\/INTAKE_DATA\]/);
      if (dataMatch) {
        try { parsedIntakeData = JSON.parse(dataMatch[1].trim()); } catch { /* ignore */ }
      }
      // Detect completion
      if (buf.includes("[INTAKE_COMPLETE]")) {
        setIntakeComplete(true);
        const cleanSummary = buf
          .replace(/\[INTAKE_DATA\][\s\S]*?\[\/INTAKE_DATA\]/g, "")
          .replace("[INTAKE_COMPLETE]", "")
          .trim();
        setIntakeSummary(cleanSummary);
        if (parsedIntakeData) {
          // Store structured data for save route
          (window as any).__intakeParsedData = parsedIntakeData;
        }
      }
    } finally {
      setIntakeStreaming(false);
    }
  }

  function sendIntake() {
    const msg = intakeInput.trim();
    if (!msg || intakeStreaming) return;
    setIntakeInput("");
    streamIntake(msg);
  }

  // ── Schedule helpers ────────────────────────────────────────────────────────
  function toggleDay(day: string) {
    setScheduleDays(prev => {
      const exists = prev.find(d => d.day === day);
      if (exists) return prev.filter(d => d.day !== day);
      return [...prev, { day, type: "lifting", time: "morning" }];
    });
  }

  function updateDayField(day: string, field: "type" | "time", value: string) {
    setScheduleDays(prev =>
      prev.map(d => d.day === day ? { ...d, [field]: value } : d)
    );
  }

  function openCalendar() {
    if (!calendarToken) return;
    const host = window.location.host;
    const protocol = window.location.protocol;
    // webcal:// for iOS/Android auto-subscribe
    const webcalUrl = `webcal://${host}/api/calendar/feed?token=${calendarToken}`;
    window.location.href = webcalUrl;
    setCalendarLinked(true);
  }

  // ── Video frame analysis for overhead squat ────────────────────────────────
  const [videoAnalyzing, setVideoAnalyzing] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);

  async function analyzeMovementVideo(file: File) {
    setVideoAnalyzing(true);
    try {
      const frames = await extractVideoFrames(file, 4);
      const res = await fetch("/api/dashboard/movement-analysis", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: "overhead_squat", frames }),
      });
      const d = await res.json();
      const analysisText = d.summary
        ? `${d.score}: ${d.summary}${d.flags?.length ? ` Flags: ${d.flags.join(", ")}.` : ""}`
        : "Could not analyse video.";
      setMovementAnswers(prev => ({
        ...prev,
        overhead_squat: { ...(prev.overhead_squat || {}), video_analysis: analysisText, video_score: d.score, video_flags: d.flags },
      }));
    } catch (err) {
      console.error("Video analysis failed:", err);
    } finally {
      setVideoAnalyzing(false);
    }
  }

  async function extractVideoFrames(file: File, count: number): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const url = URL.createObjectURL(file);
      video.src = url;
      video.preload = "metadata";
      const frames: string[] = [];
      let captured = 0;

      video.onloadedmetadata = () => {
        const dur = video.duration;
        const captureAt = (t: number) => { video.currentTime = t; };
        video.onseeked = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = Math.round(640 * (video.videoHeight / video.videoWidth));
          canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
          captured++;
          if (captured < count) captureAt(dur * ((captured + 1) / (count + 1)));
          else { URL.revokeObjectURL(url); resolve(frames); }
        };
        captureAt(dur * (1 / (count + 1)));
      };
      video.onerror = reject;
    });
  }

  // ── Movement test helpers ───────────────────────────────────────────────────
  function setAnswer(testId: string, questionId: string, value: string) {
    setMovementAnswers(prev => ({
      ...prev,
      [testId]: { ...(prev[testId] || {}), [questionId]: value },
    }));
  }

  function currentTestComplete() {
    const test = MOVEMENT_TESTS[movementIdx];
    const answers = movementAnswers[test.id] || {};
    return test.questions.every(q => answers[q.id]);
  }

  // ── Save onboarding + go to dashboard ──────────────────────────────────────
  async function finishOnboarding() {
    setSaving(true);
    try {
      // Use parsed structured data if available, else fall back to plain summary
      const parsedData = (window as any).__intakeParsedData;
      const intakeDataPayload = parsedData || { summary: intakeSummary };
      const res = await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          intake_data: intakeDataPayload,
          schedule_data: { days: scheduleDays },
          movement_results: movementAnswers,
          intake_summary: intakeSummary,
        }),
      });
      const d = await res.json();
      if (d.calendarToken) setCalendarToken(d.calendarToken);
      localStorage.setItem("onboarding_complete", "true");
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: T.bg,
    color: T.text,
    fontFamily: "'Inter', -apple-system, sans-serif",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: isMobile ? "0" : "40px 20px",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: "600px",
    background: T.surface,
    border: isMobile ? "none" : `1px solid ${T.border}`,
    borderRadius: isMobile ? "0" : "16px",
    minHeight: isMobile ? "100vh" : "auto",
    overflow: "hidden",
  };

  // ── Progress indicator ───────────────────────────────────────────────────────
  const STEPS: Step[] = ["intro", "intake", "schedule", "movement", "foundation"];
  const stepIdx = STEPS.indexOf(step);

  function ProgressBar() {
    if (step === "intro" || step === "done") return null;
    return (
      <div style={{ padding: "16px 24px 0", display: "flex", gap: "6px" }}>
        {STEPS.slice(1).map((s, i) => (
          <div key={s} style={{
            flex: 1, height: "3px", borderRadius: "99px",
            background: i < stepIdx ? T.accent : i === stepIdx - 1 ? T.accent : T.border,
            opacity: i < stepIdx ? 1 : i === stepIdx - 1 ? 1 : 0.3,
            transition: "all 0.3s",
          }} />
        ))}
      </div>
    );
  }

  // ── STEP: INTRO ──────────────────────────────────────────────────────────────
  if (step === "intro") {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 32px", gap: "32px" }}>
          {/* CF Badge */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: T.accent, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "18px", color: T.bg,
              fontWeight: 700, fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.04em",
              flexShrink: 0,
            }}>CF</div>
            <div>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.08em", color: T.accent }}>
                COACH FRANKLIN
              </div>
              <div style={{ fontSize: "12px", color: T.muted }}>Elite Performance System</div>
            </div>
          </div>

          {/* Franklin speaks */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "20px", lineHeight: 1.5, fontWeight: 300, margin: 0, color: T.text }}>
              I&apos;m not a generic fitness app.
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.8, color: T.muted, margin: 0 }}>
              I don&apos;t hand you a 12-week program and wish you luck. I build a system around
              how <em style={{ color: T.text, fontStyle: "normal" }}>you specifically</em> move,
              recover, and compete — and I adjust it as things change.
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.8, color: T.muted, margin: 0 }}>
              To do that, I need to know you. We&apos;ll spend about 15 minutes doing that
              right now — a conversation, a quick movement screen, and locking in your schedule.
              After that, you&apos;re in the system.
            </p>
          </div>

          {/* What's coming */}
          <div style={{
            background: T.surface2, border: `1px solid ${T.border}`,
            borderRadius: "12px", padding: "20px",
            display: "flex", flexDirection: "column", gap: "12px",
          }}>
            {[
              ["💬", "Intake conversation", "Tell me about your training. I'll ask the right questions."],
              ["📅", "Set your schedule", "Lock in specific days and times. I'll put them in your calendar."],
              ["🏃", "Movement screen", "5 quick self-tests. Takes 10 minutes. Shapes everything."],
              ["⚡", "Foundation Week begins", "Your first week is designed to read your body before I build your program."],
            ].map(([icon, title, desc]) => (
              <div key={title as string} style={{ display: "flex", gap: "14px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "18px", flexShrink: 0, marginTop: "1px" }}>{icon}</span>
                <div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "2px", color: T.text }}>{title}</div>
                  <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep("intake")}
            style={{
              background: T.accent, border: "none", borderRadius: "10px",
              color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
              fontSize: "1.2rem", letterSpacing: "0.1em", padding: "16px",
              width: "100%", transition: "opacity 0.15s",
            }}
          >
            LET&apos;S START
          </button>

          <p style={{ fontSize: "11px", color: T.muted, textAlign: "center", margin: 0 }}>
            Takes about 15 minutes · You&apos;ll need a wall and a bed or couch for the movement screen
          </p>
        </div>
      </div>
    );
  }

  // ── STEP: INTAKE ─────────────────────────────────────────────────────────────
  if (step === "intake") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <ProgressBar />
          <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: T.accent }}>
              INTAKE CONVERSATION
            </div>
            <div style={{ fontSize: "12px", color: T.muted, marginTop: "2px" }}>
              Franklin is building your profile. Answer naturally — he&apos;ll ask follow-ups for anything missing.
            </div>
          </div>

          {/* Chat area */}
          <div style={{
            padding: "20px 24px",
            minHeight: "340px", maxHeight: isMobile ? "calc(100vh - 260px)" : "440px",
            overflowY: "auto",
            display: "flex", flexDirection: "column", gap: "14px",
          }}>
            {intakeMsgs.map((m, i) => (
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
                  borderRadius: "12px", padding: "12px 16px",
                  fontSize: "14px", lineHeight: 1.75, color: T.text,
                  maxWidth: "85%", whiteSpace: "pre-wrap",
                }}>
                  {m.content || <span style={{ color: T.muted }}>▌</span>}
                </div>
              </div>
            ))}
            <div ref={intakeEndRef} />
          </div>

          {/* Input or completion */}
          <div style={{ padding: "16px 24px", borderTop: `1px solid ${T.border}` }}>
            {intakeComplete ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ fontSize: "13px", color: T.green, fontWeight: 600 }}>
                  ✓ Franklin has everything he needs.
                </div>
                <button
                  onClick={() => setStep("schedule")}
                  style={{
                    background: T.accent, border: "none", borderRadius: "8px",
                    color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                    fontSize: "1rem", letterSpacing: "0.08em", padding: "13px",
                    width: "100%",
                  }}
                >
                  NEXT — SET YOUR SCHEDULE →
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  value={intakeInput}
                  onChange={e => setIntakeInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendIntake()}
                  placeholder={intakeStreaming ? "Franklin is typing…" : "Your answer…"}
                  disabled={intakeStreaming}
                  style={{
                    flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: "8px", color: T.text, fontSize: "14px",
                    padding: "12px 14px", outline: "none",
                    opacity: intakeStreaming ? 0.5 : 1,
                  }}
                />
                <button
                  onClick={sendIntake}
                  disabled={!intakeInput.trim() || intakeStreaming}
                  style={{
                    background: T.accent, border: "none", borderRadius: "8px",
                    color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                    fontSize: "0.9rem", letterSpacing: "0.06em", padding: "12px 18px",
                    opacity: !intakeInput.trim() || intakeStreaming ? 0.4 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  SEND
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: SCHEDULE ───────────────────────────────────────────────────────────
  if (step === "schedule") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <ProgressBar />
          <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: T.accent }}>
              YOUR TRAINING SCHEDULE
            </div>
            <div style={{ fontSize: "12px", color: T.muted, marginTop: "2px" }}>
              Scheduling specific times is the difference between athletes who show up and athletes who don&apos;t.
              Lock in your days — I&apos;ll put them in your calendar automatically.
            </div>
          </div>

          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px" }}>

            {/* Day selector */}
            <div>
              <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "10px" }}>
                Which days will you train?
              </p>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {DAYS.map(day => {
                  const selected = scheduleDays.find(d => d.day === day);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      style={{
                        padding: "8px 14px", borderRadius: "8px", cursor: "pointer",
                        fontSize: "13px", fontWeight: 600, transition: "all 0.15s",
                        background: selected ? T.accent : T.surface2,
                        border: `1px solid ${selected ? T.accent : T.border}`,
                        color: selected ? T.bg : T.muted,
                      }}
                    >
                      {DAY_LABELS[day]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Per-day settings */}
            {scheduleDays.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, margin: 0 }}>
                  Configure each day
                </p>
                {scheduleDays
                  .sort((a, b) => DAYS.indexOf(a.day as typeof DAYS[number]) - DAYS.indexOf(b.day as typeof DAYS[number]))
                  .map(slot => (
                  <div key={slot.day} style={{
                    background: T.surface2, border: `1px solid ${T.border}`,
                    borderRadius: "10px", padding: "14px 16px",
                    display: "flex", flexDirection: "column", gap: "10px",
                  }}>
                    <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.04em", color: T.accent }}>
                      {DAY_LABELS[slot.day]}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {SESSION_TYPES.map(type => (
                        <button
                          key={type}
                          onClick={() => updateDayField(slot.day, "type", type)}
                          style={{
                            padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
                            fontSize: "11px", fontWeight: 600, transition: "all 0.15s",
                            background: slot.type === type ? T.accentDim : "transparent",
                            border: `1px solid ${slot.type === type ? T.accent : T.border}`,
                            color: slot.type === type ? T.accent : T.muted,
                          }}
                        >
                          {SESSION_TYPE_LABELS[type]}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {TIME_OPTIONS.map(time => (
                        <button
                          key={time}
                          onClick={() => updateDayField(slot.day, "time", time)}
                          style={{
                            padding: "5px 12px", borderRadius: "6px", cursor: "pointer",
                            fontSize: "11px", transition: "all 0.15s",
                            background: slot.time === time ? T.surface : "transparent",
                            border: `1px solid ${slot.time === time ? T.accent : T.border}`,
                            color: slot.time === time ? T.text : T.muted,
                          }}
                        >
                          {TIME_LABELS[time]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Calendar sync */}
            {scheduleDays.length > 0 && (
              <div style={{
                background: `linear-gradient(135deg, ${T.surface2} 0%, rgba(200,169,110,0.05) 100%)`,
                border: `1px solid ${T.border}`,
                borderRadius: "12px", padding: "16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "20px" }}>📅</span>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: T.text }}>Sync to your calendar</div>
                    <div style={{ fontSize: "11px", color: T.muted }}>
                      One tap — sessions appear automatically and stay updated.
                    </div>
                  </div>
                </div>
                <button
                  onClick={openCalendar}
                  style={{
                    width: "100%", padding: "10px", borderRadius: "8px", cursor: "pointer",
                    background: calendarLinked ? T.green + "18" : T.accentDim,
                    border: `1px solid ${calendarLinked ? T.green : T.accent}`,
                    color: calendarLinked ? T.green : T.accent,
                    fontSize: "12px", fontWeight: 700, letterSpacing: "0.08em",
                    fontFamily: "'BebasNeue', sans-serif",
                  }}
                >
                  {calendarLinked ? "✓ CALENDAR LINKED" : "ADD TO CALENDAR (OPTIONAL)"}
                </button>
                <p style={{ fontSize: "10px", color: T.muted, margin: "8px 0 0", textAlign: "center" }}>
                  Works with Apple Calendar, Google Calendar, and Outlook
                </p>
              </div>
            )}

            <button
              onClick={() => setStep("movement")}
              disabled={scheduleDays.length === 0}
              style={{
                background: scheduleDays.length > 0 ? T.accent : T.surface2,
                border: `1px solid ${scheduleDays.length > 0 ? T.accent : T.border}`,
                borderRadius: "10px", color: scheduleDays.length > 0 ? T.bg : T.muted,
                cursor: scheduleDays.length > 0 ? "pointer" : "default",
                fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                letterSpacing: "0.08em", padding: "14px",
                width: "100%", transition: "all 0.15s",
              }}
            >
              NEXT — MOVEMENT SCREEN →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: MOVEMENT ───────────────────────────────────────────────────────────
  if (step === "movement") {
    const test = MOVEMENT_TESTS[movementIdx];
    const answers = movementAnswers[test.id] || {};
    const testComplete = currentTestComplete();
    const isLast = movementIdx === MOVEMENT_TESTS.length - 1;

    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <ProgressBar />

          {/* Header */}
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: T.accent }}>
                MOVEMENT SCREEN
              </div>
              <div style={{ fontSize: "11px", color: T.muted }}>
                {movementIdx + 1} / {MOVEMENT_TESTS.length}
              </div>
            </div>
            {/* Mini progress */}
            <div style={{ display: "flex", gap: "4px", marginTop: "10px" }}>
              {MOVEMENT_TESTS.map((t, i) => (
                <div key={t.id} style={{
                  flex: 1, height: "3px", borderRadius: "99px",
                  background: i < movementIdx ? T.green : i === movementIdx ? T.accent : T.border,
                  transition: "all 0.3s",
                }} />
              ))}
            </div>
          </div>

          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", maxHeight: isMobile ? "calc(100vh - 160px)" : "600px" }}>

            {/* Test name */}
            <div>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.04em", color: T.text, marginBottom: "6px" }}>
                {test.name}
              </div>
              <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.6, fontStyle: "italic" }}>
                {test.why}
              </div>
            </div>

            {/* Animation */}
            <div style={{
              background: T.surface2, border: `1px solid ${T.border}`,
              borderRadius: "12px", padding: "24px",
              display: "flex", alignItems: "center", justifyContent: "center",
              minHeight: "120px",
            }}>
              {TEST_ANIMATIONS[test.id]}
            </div>

            {/* Instructions */}
            <div style={{
              background: T.accentDim, border: `1px solid ${T.accent}30`,
              borderRadius: "10px", padding: "14px 16px",
            }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: T.accent, marginBottom: "6px" }}>
                HOW TO DO IT
              </div>
              <div style={{ fontSize: "13px", lineHeight: 1.7, color: T.text }}>
                {test.setup}
              </div>
            </div>

            {/* Film this test — overhead squat only */}
            {test.film && (
              <div style={{
                background: T.surface2, border: `1px solid ${T.border}`,
                borderRadius: "10px", padding: "14px 16px",
                display: "flex", gap: "12px", alignItems: "flex-start",
              }}>
                <span style={{ fontSize: "18px", flexShrink: 0 }}>🎥</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: T.text, marginBottom: "4px" }}>
                    Film it for deeper analysis <span style={{ fontSize: "11px", fontWeight: 400, color: T.muted }}>(optional)</span>
                  </div>
                  <div style={{ fontSize: "11px", color: T.muted, lineHeight: 1.5, marginBottom: "10px" }}>
                    Record a 5-10 second clip of your squat from the side. Franklin will extract frames and analyze your movement pattern.
                  </div>
                  {movementAnswers.overhead_squat?.video_analysis ? (
                    <div style={{ fontSize: "12px", color: T.green }}>✓ Video analyzed — findings captured</div>
                  ) : (
                    <button
                      onClick={() => videoInputRef.current?.click()}
                      disabled={videoAnalyzing}
                      style={{
                        background: T.accentDim, border: `1px solid ${T.accent}`,
                        borderRadius: "7px", color: T.accent, cursor: "pointer",
                        fontSize: "12px", fontWeight: 700, padding: "7px 16px",
                        fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.06em",
                        opacity: videoAnalyzing ? 0.6 : 1,
                      }}
                    >
                      {videoAnalyzing ? "ANALYZING…" : "UPLOAD VIDEO"}
                    </button>
                  )}
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/*"
                    style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) analyzeMovementVideo(f); e.target.value = ""; }}
                  />
                </div>
              </div>
            )}

            {/* Questions */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: T.muted }}>
                WHAT DID YOU FIND?
              </div>
              {test.questions.map(q => (
                <div key={q.id}>
                  <div style={{ fontSize: "13px", color: T.text, marginBottom: "8px", fontWeight: 500 }}>{q.label}</div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {q.options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => setAnswer(test.id, q.id, opt)}
                        style={{
                          padding: "7px 14px", borderRadius: "7px", cursor: "pointer",
                          fontSize: "12px", transition: "all 0.15s",
                          background: answers[q.id] === opt ? T.accent : T.surface2,
                          border: `1px solid ${answers[q.id] === opt ? T.accent : T.border}`,
                          color: answers[q.id] === opt ? T.bg : T.muted,
                          fontWeight: answers[q.id] === opt ? 700 : 400,
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Next button */}
            <button
              onClick={() => {
                if (isLast) setStep("foundation");
                else setMovementIdx(i => i + 1);
              }}
              disabled={!testComplete}
              style={{
                background: testComplete ? T.accent : T.surface2,
                border: `1px solid ${testComplete ? T.accent : T.border}`,
                borderRadius: "10px", color: testComplete ? T.bg : T.muted,
                cursor: testComplete ? "pointer" : "default",
                fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                letterSpacing: "0.08em", padding: "14px",
                width: "100%", transition: "all 0.15s",
              }}
            >
              {isLast ? "DONE — SEE YOUR FOUNDATION WEEK →" : `NEXT TEST →`}
            </button>

            {/* Skip option */}
            <button
              onClick={() => {
                // Record as skipped so Franklin knows it wasn't done
                setMovementAnswers(prev => ({
                  ...prev,
                  [test.id]: { ...(prev[test.id] || {}), skipped: "true" },
                }));
                if (isLast) setStep("foundation");
                else setMovementIdx(i => i + 1);
              }}
              style={{
                background: "none", border: "none", color: T.muted,
                cursor: "pointer", fontSize: "11px", padding: "4px",
                textDecoration: "underline", textDecorationColor: T.border,
              }}
            >
              Skip this test
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: FOUNDATION ─────────────────────────────────────────────────────────
  if (step === "foundation") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <ProgressBar />
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "24px", overflowY: "auto", maxHeight: isMobile ? "100vh" : "700px" }}>

            {/* Franklin brief */}
            <div style={{
              background: `linear-gradient(135deg, ${T.surface2} 0%, rgba(200,169,110,0.06) 100%)`,
              border: `1px solid ${T.accent}30`,
              borderRadius: "14px", padding: "22px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <div style={{
                  width: "36px", height: "36px", borderRadius: "50%",
                  background: T.accent, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: "13px", color: T.bg,
                  fontWeight: 700, flexShrink: 0,
                }}>CF</div>
                <div>
                  <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.06em", color: T.accent }}>
                    COACH FRANKLIN
                  </div>
                  <div style={{ fontSize: "10px", color: T.muted }}>Your Foundation Week</div>
                </div>
              </div>
              <p style={{ fontSize: "14px", lineHeight: 1.85, color: T.text, margin: 0 }}>
                I could hand you a program right now. I&apos;m not going to — not yet.
              </p>
              <p style={{ fontSize: "14px", lineHeight: 1.85, color: T.muted, margin: "12px 0 0" }}>
                This first week is designed to <em style={{ color: T.text, fontStyle: "normal" }}>read you</em>.
                How you respond to volume. What your real recovery looks like.
                Where your movement findings show up under actual load. After 7 days of
                real training data, I&apos;ll have what no intake form can give me.
                Then I build your actual program around what I&apos;ve learned.
              </p>
              <p style={{ fontSize: "14px", lineHeight: 1.85, color: T.muted, margin: "12px 0 0" }}>
                Train honestly this week. <em style={{ color: T.text, fontStyle: "normal" }}>The numbers don&apos;t matter — the patterns do.</em>
              </p>
            </div>

            {/* What Franklin is watching for */}
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", color: T.muted, marginBottom: "12px" }}>
                WHAT FRANKLIN IS WATCHING FOR
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  ["📊", "Volume tolerance", "How your body handles the training load across the week"],
                  ["⚡", "Strength baselines", "One calibration set per major pattern to anchor future percentages"],
                  ["🔄", "Recovery patterns", "How you feel 24h after each session tells me your capacity"],
                  ["⚖️", "Side-to-side balance", "Whether your movement screen findings show up under load"],
                ].map(([icon, title, desc]) => (
                  <div key={title as string} style={{
                    background: T.surface2, border: `1px solid ${T.border}`,
                    borderRadius: "10px", padding: "12px 14px",
                    display: "flex", gap: "12px", alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: "16px", flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: T.text, marginBottom: "2px" }}>{title}</div>
                      <div style={{ fontSize: "11px", color: T.muted, lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* What you need to do */}
            <div style={{
              background: T.surface2, border: `1px solid ${T.border}`,
              borderLeft: `3px solid ${T.accent}`,
              borderRadius: "0 10px 10px 0", padding: "14px 16px",
            }}>
              <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: T.accent, marginBottom: "8px" }}>
                YOUR JOB THIS WEEK
              </div>
              <div style={{ fontSize: "13px", color: T.muted, lineHeight: 1.8 }}>
                Show up on your scheduled days. Log your sessions — takes 2 minutes after each one.
                Check in with your readiness each morning. After 7 days, Franklin debriefs you.
              </div>
            </div>

            {/* Postural screening callout */}
            <div style={{
              background: T.accentDim, border: `1px solid ${T.accent}30`,
              borderRadius: "12px", padding: "16px",
              display: "flex", gap: "14px", alignItems: "flex-start",
            }}>
              <span style={{ fontSize: "22px", flexShrink: 0 }}>📸</span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: T.text, marginBottom: "4px" }}>
                  Postural screening — anytime this week
                </div>
                <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.6 }}>
                  Whenever you have 5 minutes and a plain wall: go to the Assessment tab and run your postural screening.
                  Franklin will analyze your photos and build a full movement report around your findings today.
                </div>
              </div>
            </div>

            <button
              onClick={finishOnboarding}
              disabled={saving}
              style={{
                background: saving ? T.surface2 : T.accent,
                border: `1px solid ${saving ? T.border : T.accent}`,
                borderRadius: "10px", color: saving ? T.muted : T.bg,
                cursor: saving ? "default" : "pointer",
                fontFamily: "'BebasNeue', sans-serif", fontSize: "1.2rem",
                letterSpacing: "0.1em", padding: "16px",
                width: "100%", transition: "all 0.15s",
              }}
            >
              {saving ? "SETTING UP YOUR DASHBOARD…" : "ENTER THE SYSTEM →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
