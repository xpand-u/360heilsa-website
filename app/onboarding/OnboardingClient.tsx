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

type Step = "intro" | "intake" | "upload" | "schedule" | "movement" | "foundation" | "done";

// ─── Movement tests definition ────────────────────────────────────────────────
// YouTube video IDs for each movement demo — swap these for your preferred clips
const MOVEMENT_VIDEOS: Record<string, string> = {
  overhead_squat:      "0CIxWWMy5D4", // FMS official — Overhead Deep Squat assessment
  aslr:               "t9AsBEtlSJk", // FMS-aligned ASLR assessment demo
  ankle_dorsiflexion: "u3NbKOXl75k", // Aleks Physio — Knee-to-Wall ankle mobility test
  wall_angels:        "JQsSjHjRV5w", // Wall Angels with coaching cues
  posture:            "KMgbOr5LSUY", // Postural assessment — what to look for front and side
  thomas_test:        "NMDd-4NspHs", // Physiotutors — Thomas Test / Iliopsoas Tightness
};

const MOVEMENT_TESTS = [
  {
    id: "overhead_squat",
    name: "Overhead Squat",
    why: "This single movement tells me about your ankles, hips, thoracic spine, and shoulders simultaneously. It's the most efficient test I have.",
    setup: "Stand with feet shoulder-width apart, toes pointing slightly out. Raise both arms straight up overhead — elbows fully straight, arms close to your head. Squat as deep as you can while keeping your arms pointing up and your heels flat on the floor. Do 3 slow reps. Film yourself from the side if possible — it makes this much easier to assess.",
    film: true,
    questions: [
      { id: "arms_fall", label: "Did your arms drift forward as you squatted?", options: ["Yes, noticeably", "Slightly", "No, stayed vertical"] },
      { id: "heels_rise", label: "Did your heels come off the floor?", options: ["Yes", "Slightly", "No"] },
      { id: "knees_cave", label: "Did your knees collapse inward?", options: ["Both sides", "Left only", "Right only", "No"] },
      { id: "depth", label: "How deep could you squat?", options: ["Thighs below horizontal (deep squat)", "Thighs roughly horizontal — like sitting in a chair", "Couldn't get to chair height"] },
    ],
  },
  {
    id: "aslr",
    name: "Active Straight Leg Raise",
    why: "Shows me your hamstring length and whether your pelvis stays stable while one leg moves. Asymmetry here is common and shapes how I program you.",
    setup: "Lie flat on your back on the floor, both legs straight. Before you start, press the back of your resting leg hard into the floor — keep it there the whole time. Raise the other leg as high as you can, keeping the knee straight (no bending at the knee). Stop the moment you feel tightness behind your leg, or when the resting leg starts to lift off the floor. Have someone watch or prop your phone up to see your angle. Switch sides.",
    film: false,
    questions: [
      { id: "right_height", label: "Right leg — where did it stop?", options: ["Pointing straight up at the ceiling or past", "About halfway up — pointing at the far wall", "Low — closer to the floor than vertical"] },
      { id: "left_height", label: "Left leg — where did it stop?", options: ["Pointing straight up at the ceiling or past", "About halfway up — pointing at the far wall", "Low — closer to the floor than vertical"] },
      { id: "flat_leg_stays", label: "Did the resting leg stay flat on the floor?", options: ["Yes, both sides", "It lifted slightly on one side", "It lifted on both sides"] },
    ],
  },
  {
    id: "ankle_dorsiflexion",
    name: "Ankle Mobility Test",
    why: "Limited ankle mobility is one of the most common reasons squat depth fails, knees compensate, and runners develop downstream issues. Takes 2 minutes to screen.",
    setup: "Stand barefoot facing a wall. Place your big toe close to the wall — just enough to slide a finger in the gap. Keep your heel flat on the floor and drive your knee forward to touch the wall. If you can do it, move your foot further back and try again. Find the furthest distance where your knee can still touch the wall without your heel lifting. Test both ankles.",
    film: false,
    questions: [
      { id: "right_ankle", label: "Right ankle — what was your furthest distance?", options: ["Beyond a hand-length (15cm+)", "Around a fist-width (10–14cm)", "Less than a fist-width (under 10cm)"] },
      { id: "left_ankle", label: "Left ankle — what was your furthest distance?", options: ["Beyond a hand-length (15cm+)", "Around a fist-width (10–14cm)", "Less than a fist-width (under 10cm)"] },
      { id: "asymmetry", label: "Was there a clear difference between ankles?", options: ["Yes, significant difference", "Slight difference", "Both felt the same"] },
    ],
  },
  {
    id: "wall_angels",
    name: "Wall Angels",
    why: "Tells me about your thoracic extension and shoulder mobility — both critical for overhead pressing, posture under load, and injury prevention.",
    setup: "Stand with your back against a wall, heels about 15cm away. Press your entire back against the wall — head, upper back, and lower back all in contact. Raise your arms to a goalpost position (elbows at shoulder height, bent 90°) and press them flat against the wall. Slowly slide your arms up overhead, then back down, keeping your head, back, and arms touching the wall the entire time. Notice what lifts or loses contact.",
    film: false,
    questions: [
      { id: "arms_stay", label: "How far could you slide your arms up while keeping them on the wall?", options: ["All the way overhead — full contact throughout", "Past halfway up, but lost contact before reaching overhead", "Lost contact almost immediately from the starting position"] },
      { id: "back_stays", label: "What did your lower back do as your arms rose?", options: ["Stayed flat against the wall", "Lifted slightly off the wall", "Pulled away significantly from the wall"] },
    ],
  },
  {
    id: "posture",
    name: "Postural Analysis",
    why: "Static posture tells me about your habitual patterns — forward head, rounded shoulders, pelvic tilt, asymmetries. These show up in your training and predict where problems will develop.",
    setup: "Wear fitted clothing or no shirt. Stand naturally — don't try to stand 'perfectly'. Set your phone on a surface at hip height using the self-timer, or have someone take the photos. Stand about 2 metres away. Take all 4 photos (front, both sides, back) and upload them below — Franklin analyzes all 4 together for the most accurate read.",
    film: false,
    photoAnalysis: true,
    questions: [
      { id: "head_position", label: "Looking at your side photo — where is your head?", options: ["Ears roughly over shoulders", "Head slightly forward of shoulders", "Head noticeably forward (chin jutting out)"] },
      { id: "shoulders", label: "Looking at your front photo — your shoulders:", options: ["Even height, sitting back", "One higher than the other", "Both rounded forward"] },
      { id: "lower_back", label: "Looking at your side photo — your lower back:", options: ["Moderate curve — looks neutral", "Very flat (no curve)", "Exaggerated curve (belly pushes forward)"] },
      { id: "feet", label: "Looking at your front photo — your feet point:", options: ["Mostly straight ahead", "Both turned out", "Unevenly — one out, one straight"] },
    ],
  },
  {
    id: "thomas_test",
    name: "Hip Flexor Test",
    why: "Tight hip flexors affect your squat, running gait, posture, and lower back. Extremely common in anyone who sits during the day.",
    setup: "Sit on the edge of a bed or firm couch with your legs hanging off. Lie back and pull both knees to your chest. Then let one leg slowly lower and hang off the edge — keep the other knee hugged to your chest. Let the hanging leg fully relax. Notice two things: does the thigh drop toward the floor, and does the knee stay bent or start to straighten? Hold for a few seconds, then switch sides.",
    film: false,
    questions: [
      { id: "right_hip", label: "Right leg — where does the thigh hang?", options: ["Drops to roughly horizontal (flat)", "Stays slightly above horizontal", "Stays well above horizontal"] },
      { id: "left_hip", label: "Left leg — where does the thigh hang?", options: ["Drops to roughly horizontal (flat)", "Stays slightly above horizontal", "Stays well above horizontal"] },
      { id: "knee_flexion", label: "What does the hanging leg's knee do?", options: ["Stays bent around 90°", "Straightens out somewhat", "Straightens almost fully"] },
    ],
  },
];

// ─── Video Demo Thumbnail ─────────────────────────────────────────────────────
function VideoDemoThumbnail({ testId, onPlay }: { testId: string; onPlay: (id: string) => void }) {
  const videoId = MOVEMENT_VIDEOS[testId];
  if (!videoId) return null;
  return (
    <div
      onClick={() => onPlay(videoId)}
      style={{
        position: "relative", width: "100%", borderRadius: "10px",
        overflow: "hidden", cursor: "pointer", aspectRatio: "16/9",
        background: T.surface2,
      }}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
        alt="Exercise demo"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      {/* Dark overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, rgba(0,0,0,0.1), rgba(0,0,0,0.45))",
      }} />
      {/* Play button */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          background: "rgba(200,169,110,0.92)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M6 3.5L14.5 9L6 14.5V3.5Z" fill="#0c0c0b" />
          </svg>
        </div>
      </div>
      <div style={{
        position: "absolute", bottom: "8px", left: "10px",
        fontSize: "10px", color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}>
        Watch demo
      </div>
    </div>
  );
}

// ─── Schedule Days ─────────────────────────────────────────────────────────────
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, string> = {
  mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun",
};
const SESSION_TYPES = ["lifting", "run", "jits", "other"] as const;
const SESSION_TYPE_LABELS: Record<string, string> = {
  lifting: "Lift", run: "Run", jits: "BJJ", other: "Other",
};
const DURATION_OPTIONS = [30, 45, 60, 75, 90];
const DEFAULT_DURATION: Record<string, number> = {
  lifting: 75, run: 45, jits: 90, conditioning: 60, mobility: 45, other: 60,
};
// Maps vague AI suggestions to sensible default times
const TIME_PRESETS: Record<string, string> = {
  morning: "07:00", afternoon: "12:00", evening: "18:00",
  "early morning": "06:00", "late morning": "10:00",
  "early afternoon": "13:00", "late afternoon": "16:00",
  "late evening": "20:00",
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
  const [scheduleDays, setScheduleDays] = useState<{ day: string; type: string; time: string; frequency: string; duration: number }[]>([]);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarLinked, setCalendarLinked] = useState(false);

  // Blood panel upload state
  const [bloodPanelFile, setBloodPanelFile]       = useState<File | null>(null);
  const [bloodPanelUploading, setBloodPanelUploading] = useState(false);
  const [bloodPanelUrl, setBloodPanelUrl]         = useState<string | null>(null);
  const [bloodPanelDragging, setBloodPanelDragging] = useState(false);

  // Schedule suggestion state
  const [scheduleSuggesting, setScheduleSuggesting]   = useState(false);
  const [scheduleReasoning, setScheduleReasoning]     = useState("");
  const [scheduleSuggested, setScheduleSuggested]     = useState(false);

  // Movement state
  const [movementIdx, setMovementIdx] = useState(0);
  const [movementAnswers, setMovementAnswers] = useState<Record<string, Record<string, string | boolean>>>({});
  const [videoModalId, setVideoModalId] = useState<string | null>(null);

  // Postural photo state
  const [posturePhotos, setPosturePhotos] = useState<Record<string, string>>({});
  const [postureAnalyzing, setPostureAnalyzing] = useState(false);

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
    if (step === "schedule" && !scheduleSuggested && !scheduleSuggesting) {
      suggestSchedule();
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
        // Strip hidden tokens from visible text (including partial [INTAKE_DATA] mid-stream)
        const visibleText = buf
          .replace(/\[INTAKE_DATA\][\s\S]*?\[\/INTAKE_DATA\]/g, "")
          .replace(/\[INTAKE_DATA\][\s\S]*/g, "")
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
      // Detect completion — also treat [INTAKE_DATA] presence as completion fallback
      // in case max_tokens truncated [INTAKE_COMPLETE] off the end
      if (buf.includes("[INTAKE_COMPLETE]") || parsedIntakeData) {
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

  async function uploadBloodPanel() {
    if (!bloodPanelFile) { setStep("schedule"); return; }
    setBloodPanelUploading(true);
    try {
      const { createBrowserClient } = await import("@supabase/ssr");
      const sb = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { setStep("schedule"); return; }
      const ext = bloodPanelFile.name.split(".").pop() || "pdf";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await sb.storage.from("blood-panels").upload(path, bloodPanelFile, { upsert: true });
      if (!error) {
        const { data: urlData } = sb.storage.from("blood-panels").getPublicUrl(path);
        setBloodPanelUrl(urlData?.publicUrl || "uploaded");
        // Save URL to athlete record
        await fetch("/api/onboarding/save-blood-panel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: urlData?.publicUrl, filename: bloodPanelFile.name }),
        });
      }
    } catch { /* proceed anyway */ } finally {
      setBloodPanelUploading(false);
      setStep("schedule");
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
      return [...prev, { day, type: "lifting", time: "07:00", frequency: "every", duration: DEFAULT_DURATION.lifting }];
    });
  }

  function updateDayField(day: string, field: "type" | "time" | "frequency", value: string) {
    setScheduleDays(prev =>
      prev.map(d => {
        if (d.day !== day) return d;
        const updated = { ...d, [field]: value };
        // Auto-update duration when session type changes (only if user hasn't manually set it)
        if (field === "type") updated.duration = DEFAULT_DURATION[value] ?? 60;
        return updated;
      })
    );
  }

  function updateDayDuration(day: string, duration: number) {
    setScheduleDays(prev => prev.map(d => d.day === day ? { ...d, duration } : d));
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

  // ── Schedule suggestion ─────────────────────────────────────────────────────
  async function suggestSchedule() {
    setScheduleSuggesting(true);
    setScheduleReasoning("");
    try {
      // Fetch/generate calendar token early so sync button works on this step
      fetch("/api/onboarding/calendar-token")
        .then(r => r.json())
        .then(d => { if (d.calendarToken) setCalendarToken(d.calendarToken); })
        .catch(() => {});

      const intakeData = (window as any).__intakeParsedData || {};
      const res = await fetch("/api/onboarding/schedule-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intakeData }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.days && Array.isArray(data.days)) {
        // Pre-populate schedule
        setScheduleDays(data.days.map((d: any) => {
          const raw = (d.time || "morning").toLowerCase().trim();
          // If AI returned a HH:MM string already, use it; otherwise map from preset
          const time = /^\d{1,2}:\d{2}$/.test(raw)
            ? raw.padStart(5, "0")
            : TIME_PRESETS[raw] || "07:00";
          const type = d.type || "lifting";
          const duration = d.duration && DURATION_OPTIONS.includes(d.duration) ? d.duration : DEFAULT_DURATION[type] ?? 60;
          return { day: d.day.toLowerCase().slice(0, 3), type, time, frequency: d.frequency || "every", duration };
        }));
        setScheduleSuggested(true);
      }
      if (data.reasoning) setScheduleReasoning(data.reasoning);
    } catch { /* ignore */ } finally {
      setScheduleSuggesting(false);
    }
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

  // ── Postural photo analysis ────────────────────────────────────────────────
  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handlePosturePhoto(slot: string, file: File) {
    const b64 = await fileToBase64(file);
    const updated = { ...posturePhotos, [slot]: b64 };
    setPosturePhotos(updated);

    // Run analysis once all 4 photos are uploaded
    if (Object.keys(updated).length === 4) {
      setPostureAnalyzing(true);
      try {
        const res = await fetch("/api/dashboard/assess/screen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photos: updated }),
        });
        if (res.ok) {
          const reader = res.body!.getReader();
          const decoder = new TextDecoder();
          let report = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            report += decoder.decode(value, { stream: true });
          }
          setMovementAnswers(prev => ({
            ...prev,
            posture: { ...(prev.posture || {}), photo_analysis: report, photos_count: String(Object.keys(updated).length) },
          }));
        }
      } catch (err) {
        console.error("Posture analysis failed:", err);
      } finally {
        setPostureAnalyzing(false);
      }
    }
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
    // Video analysis unlocks next
    if (test.film && answers.video_analysis) return true;
    // Photo upload unlocks posture test (either analysis done or at least 1 photo + questions answered)
    if ((test as any).photoAnalysis) {
      // Analysis complete, or all questions answered as manual fallback
      if (answers.photo_analysis) return true;
      if (test.questions.every(q => answers[q.id])) return true;
      return false;
    }
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
      router.push("/dashboard");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  // Shared layout helpers
  const baseScreen: React.CSSProperties = {
    background: T.bg,
    color: T.text,
    fontFamily: "'Inter', -apple-system, sans-serif",
  };

  // Desktop card wrapper (not used on mobile — each step goes full-bleed)
  const desktopCard: React.CSSProperties = {
    width: "100%",
    maxWidth: "600px",
    background: T.surface,
    border: `1px solid ${T.border}`,
    borderRadius: "16px",
    overflow: "hidden",
  };

  // Step labels for progress indicator
  const STEP_META = [
    { key: "intake",      label: "Intake" },
    { key: "upload",      label: "Upload" },
    { key: "schedule",    label: "Schedule" },
    { key: "movement",    label: "Movement" },
    { key: "foundation",  label: "Foundation" },
  ];
  const activeStepIdx = STEP_META.findIndex(s => s.key === step);

  function StepProgress() {
    if (step === "intro" || step === "done") return null;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: isMobile ? "0" : "4px",
        padding: isMobile ? "14px 20px" : "16px 24px",
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
      }}>
        {STEP_META.map((s, i) => {
          const done = i < activeStepIdx;
          const active = i === activeStepIdx;
          return (
            <div key={s.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: done ? T.accent : active ? T.bg : T.surface2,
                  border: `2px solid ${done ? T.accent : active ? T.accent : T.border}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "11px", fontWeight: 700,
                  color: done ? T.bg : active ? T.accent : T.muted,
                  transition: "all 0.3s", flexShrink: 0,
                }}>
                  {done ? "✓" : i + 1}
                </div>
                {!isMobile && (
                  <div style={{
                    fontSize: "9px", fontWeight: 600, letterSpacing: "0.08em",
                    color: active ? T.accent : done ? T.text : T.muted,
                    textTransform: "uppercase", whiteSpace: "nowrap",
                  }}>{s.label}</div>
                )}
              </div>
              {i < STEP_META.length - 1 && (
                <div style={{
                  flex: 1, height: "2px", margin: "0 4px",
                  background: done ? T.accent : T.border,
                  transition: "background 0.3s",
                  marginBottom: isMobile ? 0 : "18px",
                }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── STEP: INTRO ──────────────────────────────────────────────────────────────
  if (step === "intro") {
    if (isMobile) {
      return (
        <div style={{
          ...baseScreen,
          minHeight: "100dvh",
          display: "flex", flexDirection: "column",
          paddingTop: "env(safe-area-inset-top)",
        }}>
          {/* Hero */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "48px 24px 24px" }}>
            {/* Coach identity row */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
              <img src="/logo-heilsa.png" alt="360 Heilsa" style={{ height: "40px", width: "auto", flexShrink: 0 }} />
              <div>
                <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "22px", letterSpacing: "0.08em", color: T.text, lineHeight: 1.1 }}>COACH FRANKLIN</div>
                <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: T.muted, textTransform: "uppercase", marginTop: "3px" }}>Elite Performance System</div>
              </div>
            </div>

            <p style={{ fontSize: "18px", lineHeight: 1.55, fontWeight: 300, margin: "0 0 16px", color: T.text }}>
              I&apos;m Coach Franklin. Most coaches give you a program. I build a system around you.
            </p>
            <p style={{ fontSize: "14px", lineHeight: 1.8, color: T.muted, margin: 0 }}>
              I build a system around how{" "}
              <span style={{ color: T.text }}>you specifically</span>{" "}
              move, recover, and compete — and I adjust it as you change.
            </p>
          </div>

          {/* What's next — numbered list */}
          <div style={{ padding: "0 24px 20px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em", color: T.muted, marginBottom: "14px" }}>
              WHAT HAPPENS NEXT
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {[
                ["Intake conversation", "Tell me about your training"],
                ["Lock in your schedule", "Days, times, into your calendar"],
                ["Movement screen", "5 self-tests, ~10 minutes"],
                ["Foundation Week begins", "Your first real week in the system"],
              ].map(([title, desc], i) => (
                <div key={title} style={{
                  display: "flex", gap: "14px", alignItems: "flex-start",
                  padding: "12px 0",
                  borderBottom: i < 3 ? `1px solid ${T.border}` : "none",
                }}>
                  <div style={{
                    width: "24px", height: "24px", borderRadius: "50%",
                    border: `1.5px solid ${T.accent}`, flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "11px", fontWeight: 700, color: T.accent, marginTop: "1px",
                  }}>{i + 1}</div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 600, color: T.text, marginBottom: "1px" }}>{title}</div>
                    <div style={{ fontSize: "12px", color: T.muted }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{
            padding: "16px 24px",
            paddingBottom: "max(24px, env(safe-area-inset-bottom))",
            borderTop: `1px solid ${T.border}`,
          }}>
            <button
              onClick={() => setStep("intake")}
              style={{
                background: T.accent, border: "none", borderRadius: "12px",
                color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                fontSize: "1.3rem", letterSpacing: "0.1em", padding: "18px",
                width: "100%", transition: "opacity 0.15s",
              }}
            >
              LET&apos;S START
            </button>
            <p style={{ fontSize: "11px", color: T.muted, textAlign: "center", margin: "10px 0 0" }}>
              ~15 minutes · You&apos;ll need a wall and a bed or couch
            </p>
          </div>
        </div>
      );
    }

    // Desktop intro
    return (
      <div style={{ ...baseScreen, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px", backgroundColor: T.bg }}>
        <div style={{ ...desktopCard, display: "flex", flexDirection: "column", padding: "48px 40px", gap: "32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img src="/logo-heilsa.png" alt="360 Heilsa" style={{ height: "44px", width: "auto", flexShrink: 0 }} />
            <div>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "24px", letterSpacing: "0.08em", color: T.text, lineHeight: 1.1 }}>COACH FRANKLIN</div>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.85rem", letterSpacing: "0.1em", color: T.muted, marginTop: "3px" }}>
                ELITE PERFORMANCE SYSTEM
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "20px", lineHeight: 1.5, fontWeight: 300, margin: 0, color: T.text }}>
              I&apos;m Coach Franklin. Most coaches give you a program. I build a system around you.
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.8, color: T.muted, margin: 0 }}>
              I don&apos;t hand you a 12-week program and wish you luck. I build a system around
              how <em style={{ color: T.text, fontStyle: "normal" }}>you specifically</em> move,
              recover, and compete — and I adjust it as things change.
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.8, color: T.muted, margin: 0 }}>
              To do that, I need to know you. We&apos;ll spend about 15 minutes doing that
              right now — a conversation, a quick movement screen, and locking in your schedule.
            </p>
          </div>
          <div style={{ background: T.surface2, border: `1px solid ${T.border}`, borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
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
    if (isMobile) {
      return (
        <div style={{
          ...baseScreen,
          height: "100dvh",
          display: "flex", flexDirection: "column",
          paddingTop: "env(safe-area-inset-top)",
        }}>
          <StepProgress />

          {/* Header */}
          <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.08em", color: T.accent }}>
              INTAKE CONVERSATION
            </div>
            <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
              Answer naturally — Franklin will ask follow-ups for anything missing.
            </div>
          </div>

          {/* Chat messages — fills remaining space, scrollable */}
          <div style={{
            flex: 1, overflowY: "auto", padding: "16px 16px",
            display: "flex", flexDirection: "column", gap: "12px",
            WebkitOverflowScrolling: "touch",
          }}>
            {intakeMsgs.map((m, i) => (
              <div key={i} style={{
                display: "flex", gap: "8px",
                flexDirection: m.role === "user" ? "row-reverse" : "row",
                alignItems: "flex-end",
              }}>
                {m.role === "assistant" && (
                  <div style={{
                    width: "26px", height: "26px", borderRadius: "50%",
                    background: T.accent, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: "9px", color: T.bg,
                    fontWeight: 700, flexShrink: 0,
                  }}>CF</div>
                )}
                <div style={{
                  background: m.role === "user" ? T.accent : T.surface2,
                  borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "10px 14px",
                  fontSize: "14px", lineHeight: 1.6, color: m.role === "user" ? T.bg : T.text,
                  maxWidth: "82%", whiteSpace: "pre-wrap",
                }}>
                  {m.content || <span style={{ opacity: 0.5 }}>▌</span>}
                </div>
              </div>
            ))}
            <div ref={intakeEndRef} />
          </div>

          {/* Input bar — pinned to bottom, clears home indicator */}
          <div style={{
            flexShrink: 0, padding: "10px 16px",
            paddingBottom: "max(10px, env(safe-area-inset-bottom))",
            borderTop: `1px solid ${T.border}`,
            background: T.surface,
          }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {intakeComplete && (
                <button
                  onClick={() => setStep("upload")}
                  style={{
                    background: T.accent, border: "none", borderRadius: "10px",
                    color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                    fontSize: "1rem", letterSpacing: "0.08em", padding: "15px",
                    width: "100%",
                  }}
                >
                  NEXT — SET YOUR SCHEDULE →
                </button>
              )}
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                <textarea
                  value={intakeInput}
                  onChange={e => { setIntakeInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendIntake())}
                  placeholder={intakeStreaming ? "Franklin is typing…" : intakeComplete ? "Anything to add before continuing…" : "Your answer…"}
                  disabled={intakeStreaming}
                  rows={1}
                  style={{
                    flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: "16px", color: T.text, fontSize: "16px",
                    padding: "11px 16px", outline: "none", resize: "none",
                    opacity: intakeStreaming ? 0.5 : 1, lineHeight: 1.5,
                    fontFamily: "inherit", overflow: "hidden",
                  }}
                />
                <button
                  onClick={sendIntake}
                  disabled={!intakeInput.trim() || intakeStreaming}
                  style={{
                    width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
                    background: !intakeInput.trim() || intakeStreaming ? T.surface2 : T.accent,
                    border: "none", cursor: !intakeInput.trim() || intakeStreaming ? "default" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "18px", transition: "background 0.15s",
                  }}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Desktop intake
    return (
      <div style={{ ...baseScreen, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={desktopCard}>
          <StepProgress />
          <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: T.accent }}>
              INTAKE CONVERSATION
            </div>
            <div style={{ fontSize: "12px", color: T.muted, marginTop: "2px" }}>
              Franklin is building your profile. Answer naturally — he&apos;ll ask follow-ups for anything missing.
            </div>
          </div>
          <div style={{
            padding: "20px 24px", minHeight: "340px", maxHeight: "440px",
            overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px",
          }}>
            {intakeMsgs.map((m, i) => (
              <div key={i} style={{
                display: "flex", gap: "10px",
                flexDirection: m.role === "user" ? "row-reverse" : "row", alignItems: "flex-start",
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
          <div style={{ padding: "16px 24px", borderTop: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {intakeComplete && (
                <button
                  onClick={() => setStep("upload")}
                  style={{
                    background: T.accent, border: "none", borderRadius: "8px",
                    color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                    fontSize: "1rem", letterSpacing: "0.08em", padding: "13px", width: "100%",
                  }}
                >NEXT — SET YOUR SCHEDULE →</button>
              )}
              <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                <textarea
                  value={intakeInput}
                  onChange={e => { setIntakeInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendIntake())}
                  placeholder={intakeStreaming ? "Franklin is typing…" : intakeComplete ? "Anything to add before continuing…" : "Your answer…"}
                  disabled={intakeStreaming}
                  rows={1}
                  style={{
                    flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                    borderRadius: "8px", color: T.text, fontSize: "14px",
                    padding: "12px 14px", outline: "none", resize: "none",
                    opacity: intakeStreaming ? 0.5 : 1, lineHeight: 1.5,
                    fontFamily: "inherit", overflow: "hidden",
                  }}
                />
                <button
                  onClick={sendIntake}
                  disabled={!intakeInput.trim() || intakeStreaming}
                  style={{
                    background: T.accent, border: "none", borderRadius: "8px",
                    color: T.bg, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif",
                    fontSize: "0.9rem", letterSpacing: "0.06em", padding: "12px 18px",
                    opacity: !intakeInput.trim() || intakeStreaming ? 0.4 : 1, transition: "opacity 0.15s",
                  }}
                >SEND</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: UPLOAD (blood panel) ───────────────────────────────────────────────
  if (step === "upload") {
    const content = (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "24px" }}>
        {/* Explanation */}
        <div style={{ background: T.accentDim, border: `1px solid rgba(200,169,110,0.2)`, borderRadius: "12px", padding: "18px" }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: T.text, marginBottom: "8px" }}>Got a blood panel?</div>
          <p style={{ fontSize: "13px", color: T.muted, lineHeight: 1.7, margin: 0 }}>
            Upload your most recent blood work and I can factor it into your programming — recovery capacity, iron levels, testosterone, vitamin D. It changes how I load you.
          </p>
        </div>

        {/* Upload area */}
        <div>
          <label
            onDragOver={e => { e.preventDefault(); setBloodPanelDragging(true); }}
            onDragEnter={e => { e.preventDefault(); setBloodPanelDragging(true); }}
            onDragLeave={() => setBloodPanelDragging(false)}
            onDrop={e => {
              e.preventDefault();
              setBloodPanelDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) { setBloodPanelFile(f); setBloodPanelUrl("pending"); }
            }}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "10px", padding: "36px 20px", borderRadius: "12px", cursor: "pointer",
              border: `2px dashed ${bloodPanelUrl ? T.green : bloodPanelDragging ? T.accent : T.border}`,
              background: bloodPanelUrl ? "rgba(63,185,80,0.06)" : bloodPanelDragging ? "rgba(200,169,110,0.08)" : T.surface2,
              transition: "all 0.15s",
            }}>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.heif,.webp,.tiff,.tif,.bmp,.gif" style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) { setBloodPanelFile(f); setBloodPanelUrl("pending"); }
              }}
            />
            {bloodPanelUrl && bloodPanelUrl !== "pending" ? (
              <>
                <span style={{ fontSize: "28px" }}>✓</span>
                <span style={{ fontSize: "13px", color: T.green, fontWeight: 600 }}>Uploaded</span>
              </>
            ) : bloodPanelFile ? (
              <>
                <span style={{ fontSize: "24px" }}>📄</span>
                <span style={{ fontSize: "13px", color: T.text }}>{bloodPanelFile.name}</span>
                <span style={{ fontSize: "11px", color: T.muted }}>Ready to upload</span>
              </>
            ) : bloodPanelDragging ? (
              <>
                <span style={{ fontSize: "28px", color: T.accent }}>↓</span>
                <span style={{ fontSize: "13px", color: T.accent, fontWeight: 600 }}>Drop it here</span>
              </>
            ) : (
              <>
                <span style={{ fontSize: "28px", color: T.muted }}>+</span>
                <span style={{ fontSize: "13px", color: T.text }}>Click to select or drag a file here</span>
                <span style={{ fontSize: "11px", color: T.muted }}>PDF or image</span>
              </>
            )}
          </label>
        </div>

        {/* Note */}
        <p style={{ fontSize: "11px", color: T.muted, textAlign: "center", margin: 0 }}>
          This is optional. Skip if you don&apos;t have one or don&apos;t want to share it.
        </p>
      </div>
    );

    if (isMobile) {
      return (
        <div style={{ ...baseScreen, height: "100dvh", display: "flex", flexDirection: "column", paddingTop: "env(safe-area-inset-top)" }}>
          <StepProgress />
          <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.08em", color: T.accent }}>BLOOD PANEL</div>
            <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>Optional — upload for smarter programming</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>{content}</div>
          <div style={{ flexShrink: 0, padding: "12px 20px", paddingBottom: "max(12px, env(safe-area-inset-bottom))", borderTop: `1px solid ${T.border}`, background: T.surface, display: "flex", gap: "10px" }}>
            <button onClick={() => setStep("schedule")} disabled={bloodPanelUploading}
              style={{ flex: 1, padding: "15px", borderRadius: "10px", border: `1px solid ${T.border}`, background: T.surface2, color: T.text, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em" }}>
              SKIP
            </button>
            <button onClick={uploadBloodPanel} disabled={bloodPanelUploading}
              style={{ flex: 2, padding: "15px", borderRadius: "10px", background: bloodPanelFile ? T.accent : T.surface2, color: bloodPanelFile ? T.bg : T.text, cursor: bloodPanelUploading ? "wait" : "pointer", fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", border: bloodPanelFile ? "none" : `1px solid ${T.border}` } as React.CSSProperties}>
              {bloodPanelUploading ? "UPLOADING..." : bloodPanelFile ? "SAVE AND CONTINUE →" : "SKIP FOR NOW →"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...baseScreen, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={{ ...desktopCard, maxWidth: "480px" }}>
          <StepProgress />
          <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: T.accent }}>BLOOD PANEL</div>
            <div style={{ fontSize: "12px", color: T.muted, marginTop: "2px" }}>Optional — upload your most recent blood work for smarter programming</div>
          </div>
          {content}
          <div style={{ padding: "0 24px 24px", display: "flex", gap: "10px" }}>
            <button onClick={() => setStep("schedule")} disabled={bloodPanelUploading}
              style={{ flex: 1, padding: "14px", borderRadius: "10px", border: `1px solid ${T.border}`, background: T.surface2, color: T.text, cursor: "pointer", fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em" }}>
              SKIP
            </button>
            <button onClick={uploadBloodPanel} disabled={bloodPanelUploading}
              style={{ flex: 2, padding: "14px", borderRadius: "10px", border: bloodPanelFile ? "none" : `1px solid ${T.border}`, background: bloodPanelFile ? T.accent : T.surface2, color: bloodPanelFile ? T.bg : T.text, cursor: bloodPanelUploading ? "wait" : "pointer", fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em" }}>
              {bloodPanelUploading ? "UPLOADING..." : bloodPanelFile ? "SAVE AND CONTINUE →" : "SKIP FOR NOW →"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: SCHEDULE ───────────────────────────────────────────────────────────
  if (step === "schedule") {
    const scheduleContent = (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: isMobile ? "20px 20px" : "20px 24px" }}>
        {/* Franklin's schedule recommendation */}
        {(scheduleSuggesting || scheduleReasoning) && (
          <div style={{ background: T.accentDim, border: `1px solid rgba(200,169,110,0.2)`, borderRadius: "12px", padding: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: scheduleSuggesting ? 0 : "10px" }}>
              <img src="/logo-heilsa.png" alt="360" style={{ height: "24px", width: "24px", objectFit: "contain" }} />
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: T.accent, textTransform: "uppercase" }}>
                {scheduleSuggesting ? "Franklin is building your schedule..." : "Franklin's recommendation"}
              </span>
            </div>
            {scheduleReasoning && (
              <p style={{ fontSize: "13px", color: T.text, lineHeight: 1.7, margin: "0 0 10px" }}>{scheduleReasoning}</p>
            )}
            {scheduleSuggested && (
              <p style={{ fontSize: "11px", color: T.muted, margin: 0 }}>Schedule pre-filled below. Adjust any day if needed.</p>
            )}
          </div>
        )}

        {/* Day selector */}
        <div>
          <p style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: T.muted, marginBottom: "10px" }}>
            Which days will you train?
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "6px" }}>
            {DAYS.map(day => {
              const selected = scheduleDays.find(d => d.day === day);
              return (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  style={{
                    minHeight: "44px", borderRadius: "8px", cursor: "pointer",
                    fontSize: "12px", fontWeight: 700, transition: "all 0.15s",
                    background: selected ? T.accent : T.surface2,
                    border: `1px solid ${selected ? T.accent : T.border}`,
                    color: selected ? T.bg : T.muted,
                    padding: "0",
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
                        minHeight: "36px", padding: "5px 14px", borderRadius: "6px", cursor: "pointer",
                        fontSize: "12px", fontWeight: 600, transition: "all 0.15s",
                        background: slot.type === type ? T.accentDim : "transparent",
                        border: `1px solid ${slot.type === type ? T.accent : T.border}`,
                        color: slot.type === type ? T.accent : T.muted,
                      }}
                    >
                      {SESSION_TYPE_LABELS[type]}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "11px", color: T.muted, flexShrink: 0 }}>Start time</span>
                  <input
                    type="time"
                    value={slot.time || "07:00"}
                    onChange={e => updateDayField(slot.day, "time", e.target.value)}
                    style={{
                      flex: 1, background: T.bg, border: `1px solid ${T.border}`,
                      borderRadius: "8px", color: T.text, fontSize: "15px",
                      padding: "8px 12px", outline: "none", fontFamily: "inherit",
                      cursor: "pointer",
                    }}
                  />
                </div>
                {/* Duration chips */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "11px", color: T.muted, flexShrink: 0 }}>Duration</span>
                  <div style={{ display: "flex", gap: "5px", flex: 1 }}>
                    {DURATION_OPTIONS.map(mins => (
                      <button
                        key={mins}
                        onClick={() => updateDayDuration(slot.day, mins)}
                        style={{
                          flex: 1, padding: "6px 0", borderRadius: "6px", cursor: "pointer",
                          fontSize: "11px", fontWeight: 600, transition: "all 0.15s", border: "none",
                          background: (slot.duration || DEFAULT_DURATION[slot.type] || 60) === mins ? T.accent : T.surface,
                          color: (slot.duration || DEFAULT_DURATION[slot.type] || 60) === mins ? T.bg : T.muted,
                        }}
                      >
                        {mins < 60 ? `${mins}m` : mins === 60 ? "1h" : `${Math.floor(mins/60)}h${mins%60 ? `${mins%60}` : ""}`}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Frequency toggle */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "4px", borderTop: `1px solid ${T.border}` }}>
                  <span style={{ fontSize: "11px", color: T.muted }}>Frequency</span>
                  <div style={{ display: "flex", borderRadius: "6px", overflow: "hidden", border: `1px solid ${T.border}` }}>
                    {(["every", "alternating"] as const).map(freq => (
                      <button
                        key={freq}
                        onClick={() => updateDayField(slot.day, "frequency", freq)}
                        style={{
                          padding: "5px 12px", fontSize: "11px", fontWeight: 600, cursor: "pointer", border: "none",
                          background: (slot.frequency || "every") === freq ? T.accent : "transparent",
                          color: (slot.frequency || "every") === freq ? T.bg : T.muted,
                          transition: "all 0.15s",
                        }}
                      >
                        {freq === "every" ? "Every week" : "Every other week"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Calendar sync */}
        {scheduleDays.length > 0 && (
          <div style={{
            background: `linear-gradient(135deg, ${T.surface2} 0%, rgba(200,169,110,0.05) 100%)`,
            border: `1px solid ${T.border}`, borderRadius: "12px", padding: "16px",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
              <span style={{ fontSize: "20px" }}>📅</span>
              <div>
                <div style={{ fontSize: "14px", fontWeight: 600, color: T.text }}>Sync to your calendar</div>
                <div style={{ fontSize: "11px", color: T.muted }}>One tap — sessions appear automatically and stay updated.</div>
              </div>
            </div>
            <button
              onClick={openCalendar}
              style={{
                width: "100%", minHeight: "44px", borderRadius: "8px", cursor: "pointer",
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
      </div>
    );

    if (isMobile) {
      return (
        <div style={{
          ...baseScreen, height: "100dvh",
          display: "flex", flexDirection: "column",
          paddingTop: "env(safe-area-inset-top)",
        }}>
          <StepProgress />
          <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.08em", color: T.accent }}>
              YOUR TRAINING SCHEDULE
            </div>
            <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
              Lock in specific days and times — I&apos;ll add them to your calendar automatically.
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
            {scheduleContent}
          </div>
          <div style={{
            flexShrink: 0, padding: "12px 20px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            borderTop: `1px solid ${T.border}`, background: T.surface,
          }}>
            <button
              onClick={() => setStep("movement")}
              disabled={scheduleDays.length === 0}
              style={{
                background: scheduleDays.length > 0 ? T.accent : T.surface2,
                border: `1px solid ${scheduleDays.length > 0 ? T.accent : T.border}`,
                borderRadius: "10px", color: scheduleDays.length > 0 ? T.bg : T.muted,
                cursor: scheduleDays.length > 0 ? "pointer" : "default",
                fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                letterSpacing: "0.08em", padding: "15px",
                width: "100%", transition: "all 0.15s",
              }}
            >
              NEXT — MOVEMENT SCREEN →
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...baseScreen, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={desktopCard}>
          <StepProgress />
          <div style={{ padding: "20px 24px 12px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: T.accent }}>
              YOUR TRAINING SCHEDULE
            </div>
            <div style={{ fontSize: "12px", color: T.muted, marginTop: "2px" }}>
              Scheduling specific times is the difference between athletes who show up and athletes who don&apos;t.
            </div>
          </div>
          {scheduleContent}
          <div style={{ padding: "0 24px 24px" }}>
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

    const movementContent = (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: isMobile ? "16px 20px" : "20px 24px" }}>
        {/* Test name + why */}
        <div>
          <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1.4rem", letterSpacing: "0.04em", color: T.text, marginBottom: "6px" }}>
            {test.name}
          </div>
          <div style={{ fontSize: "12px", color: T.muted, lineHeight: 1.6, fontStyle: "italic" }}>
            {test.why}
          </div>
        </div>

        {/* Video demo */}
        {MOVEMENT_VIDEOS[test.id] && (
          <VideoDemoThumbnail testId={test.id} onPlay={setVideoModalId} />
        )}

        {/* Instructions */}
        <div style={{ background: T.accentDim, border: `1px solid ${T.accent}30`, borderRadius: "10px", padding: "14px 16px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: T.accent, marginBottom: "6px" }}>
            HOW TO DO IT
          </div>
          <div style={{ fontSize: "13px", lineHeight: 1.7, color: T.text }}>
            {test.setup}
          </div>
        </div>

        {/* Film this test */}
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
                Record a 5-10 second clip from the side. Franklin will extract frames and analyze your movement pattern.
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
                    fontSize: "12px", fontWeight: 700, padding: "9px 18px",
                    fontFamily: "'BebasNeue', sans-serif", letterSpacing: "0.06em",
                    opacity: videoAnalyzing ? 0.6 : 1, minHeight: "40px",
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

        {/* Postural photo upload */}
        {(test as any).photoAnalysis && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: T.muted }}>
              UPLOAD YOUR PHOTOS <span style={{ color: T.accent }}>({Object.keys(posturePhotos).length}/4)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              {([
                ["anterior",      "Front"],
                ["right_lateral", "Right Side"],
                ["left_lateral",  "Left Side"],
                ["posterior",     "Back"],
              ] as [string, string][]).map(([slot, label]) => {
                const hasPhoto = !!posturePhotos[slot];
                return (
                  <label
                    key={slot}
                    style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      justifyContent: "center", gap: "6px",
                      border: `1.5px ${hasPhoto ? "solid" : "dashed"} ${hasPhoto ? T.accent : T.border}`,
                      borderRadius: "10px",
                      background: hasPhoto ? T.accentDim : T.surface2,
                      cursor: "pointer", padding: "14px 8px", minHeight: "80px",
                      position: "relative", overflow: "hidden",
                    }}
                  >
                    {hasPhoto ? (
                      <>
                        <img
                          src={`data:image/jpeg;base64,${posturePhotos[slot]}`}
                          alt={label}
                          style={{ width: "100%", height: "80px", objectFit: "cover", borderRadius: "6px" }}
                        />
                        <div style={{ fontSize: "10px", color: T.accent, fontWeight: 700 }}>✓ {label}</div>
                      </>
                    ) : (
                      <>
                        <span style={{ fontSize: "22px" }}>📷</span>
                        <span style={{ fontSize: "11px", color: T.muted, textAlign: "center" }}>{label}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handlePosturePhoto(slot, f); e.target.value = ""; }}
                    />
                  </label>
                );
              })}
            </div>
            {postureAnalyzing && (
              <div style={{ fontSize: "12px", color: T.accent, display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ display: "inline-block", width: "12px", height: "12px", border: `2px solid ${T.accent}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Analyzing posture…
              </div>
            )}
            {movementAnswers.posture?.photo_analysis && !postureAnalyzing && (
              <div style={{ fontSize: "12px", color: T.green }}>
                ✓ Postural analysis complete — Franklin has your findings
              </div>
            )}
            {Object.keys(posturePhotos).length > 0 && Object.keys(posturePhotos).length < 4 && !postureAnalyzing && (
              <div style={{ fontSize: "11px", color: T.muted }}>
                {4 - Object.keys(posturePhotos).length} more photo{4 - Object.keys(posturePhotos).length > 1 ? "s" : ""} to go — upload all 4 to run the analysis
              </div>
            )}
          </div>
        )}

        {/* Questions */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", color: T.muted }}>
            {test.film && movementAnswers[test.id]?.video_analysis
              ? "WHAT DID YOU FIND? (optional — video captured)"
              : (test as any).photoAnalysis && movementAnswers.posture?.photo_analysis
              ? "CONFIRM OR OVERRIDE (optional — analysis done)"
              : "WHAT DID YOU FIND?"}
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
                      minHeight: "40px", padding: "7px 14px", borderRadius: "7px", cursor: "pointer",
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

        {!isMobile && (
          <>
            <button
              onClick={() => { if (isLast) setStep("foundation"); else setMovementIdx(i => i + 1); }}
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
              {isLast ? "DONE — SEE YOUR FOUNDATION WEEK →" : "NEXT TEST →"}
            </button>
            <button
              onClick={() => {
                setMovementAnswers(prev => ({ ...prev, [test.id]: { ...(prev[test.id] || {}), skipped: true } }));
                if (isLast) setStep("foundation"); else setMovementIdx(i => i + 1);
              }}
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "11px", padding: "4px", textDecoration: "underline", textDecorationColor: T.border }}
            >
              Skip this test
            </button>
          </>
        )}
      </div>
    );

    if (isMobile) {
      return (
        <div style={{
          ...baseScreen, height: "100dvh",
          display: "flex", flexDirection: "column",
          paddingTop: "env(safe-area-inset-top)",
        }}>
          <StepProgress />

          {/* Sticky movement header */}
          <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.08em", color: T.accent }}>
                MOVEMENT SCREEN
              </div>
              <div style={{ fontSize: "12px", color: T.muted, fontWeight: 600 }}>
                {movementIdx + 1} / {MOVEMENT_TESTS.length}
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {MOVEMENT_TESTS.map((t, i) => (
                <div key={t.id} style={{
                  flex: 1, height: "4px", borderRadius: "99px",
                  background: i < movementIdx ? T.green : i === movementIdx ? T.accent : T.border,
                  transition: "all 0.3s",
                }} />
              ))}
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
            {movementContent}
          </div>

          {/* Fixed bottom CTA */}
          <div style={{
            flexShrink: 0, padding: "12px 20px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            borderTop: `1px solid ${T.border}`, background: T.surface,
            display: "flex", flexDirection: "column", gap: "8px",
          }}>
            <button
              onClick={() => { if (isLast) setStep("foundation"); else setMovementIdx(i => i + 1); }}
              disabled={!testComplete}
              style={{
                background: testComplete ? T.accent : T.surface2,
                border: `1px solid ${testComplete ? T.accent : T.border}`,
                borderRadius: "10px", color: testComplete ? T.bg : T.muted,
                cursor: testComplete ? "pointer" : "default",
                fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem",
                letterSpacing: "0.08em", padding: "15px",
                width: "100%", transition: "all 0.15s",
              }}
            >
              {isLast ? "DONE — SEE YOUR FOUNDATION WEEK →" : "NEXT TEST →"}
            </button>
            <button
              onClick={() => {
                setMovementAnswers(prev => ({ ...prev, [test.id]: { ...(prev[test.id] || {}), skipped: true } }));
                if (isLast) setStep("foundation"); else setMovementIdx(i => i + 1);
              }}
              style={{ background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: "12px", padding: "4px" }}
            >
              Skip this test
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...baseScreen, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={desktopCard}>
          <StepProgress />
          <div style={{ padding: "16px 24px", borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "1rem", letterSpacing: "0.08em", color: T.accent }}>
                MOVEMENT SCREEN
              </div>
              <div style={{ fontSize: "11px", color: T.muted }}>{movementIdx + 1} / {MOVEMENT_TESTS.length}</div>
            </div>
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
          <div style={{ padding: "20px 24px", overflowY: "auto", maxHeight: "600px" }}>
            {movementContent}
          </div>
        </div>
      </div>
    );
  }

  // ── STEP: FOUNDATION ─────────────────────────────────────────────────────────
  if (step === "foundation") {
    const foundationContent = (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: isMobile ? "20px 20px" : "20px 24px" }}>
        {/* Franklin brief */}
        <div style={{
          background: `linear-gradient(135deg, ${T.surface2} 0%, rgba(200,169,110,0.06) 100%)`,
          border: `1px solid ${T.accent}30`, borderRadius: "14px", padding: "22px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "50%",
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

        {/* Your job */}
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

        {/* Postural screening */}
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

        {!isMobile && (
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
        )}
      </div>
    );

    if (isMobile) {
      return (
        <div style={{
          ...baseScreen, height: "100dvh",
          display: "flex", flexDirection: "column",
          paddingTop: "env(safe-area-inset-top)",
        }}>
          <StepProgress />
          <div style={{ padding: "14px 20px 12px", borderBottom: `1px solid ${T.border}`, flexShrink: 0 }}>
            <div style={{ fontFamily: "'BebasNeue', sans-serif", fontSize: "0.95rem", letterSpacing: "0.08em", color: T.accent }}>
              FOUNDATION WEEK
            </div>
            <div style={{ fontSize: "11px", color: T.muted, marginTop: "2px" }}>
              Your first week in the system starts now.
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch" as any }}>
            {foundationContent}
          </div>
          <div style={{
            flexShrink: 0, padding: "12px 20px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            borderTop: `1px solid ${T.border}`, background: T.surface,
          }}>
            <button
              onClick={finishOnboarding}
              disabled={saving}
              style={{
                background: saving ? T.surface2 : T.accent,
                border: `1px solid ${saving ? T.border : T.accent}`,
                borderRadius: "10px", color: saving ? T.muted : T.bg,
                cursor: saving ? "default" : "pointer",
                fontFamily: "'BebasNeue', sans-serif", fontSize: "1.1rem",
                letterSpacing: "0.1em", padding: "16px",
                width: "100%", transition: "all 0.15s",
              }}
            >
              {saving ? "SETTING UP YOUR DASHBOARD…" : "ENTER THE SYSTEM →"}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div style={{ ...baseScreen, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
        <div style={desktopCard}>
          <StepProgress />
          <div style={{ overflowY: "auto", maxHeight: "700px" }}>
            {foundationContent}
          </div>
        </div>
      </div>
    );
  }

  // ── Video Modal ───────────────────────────────────────────────────────────────
  if (videoModalId) {
    return (
      <div
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 300,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "20px",
        }}
        onClick={() => setVideoModalId(null)}
      >
        <div
          style={{ width: "100%", maxWidth: "700px" }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ aspectRatio: "16/9", borderRadius: "12px", overflow: "hidden", background: "#000" }}>
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoModalId}?autoplay=1&rel=0&modestbranding=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              style={{ border: "none", display: "block" }}
            />
          </div>
          <button
            onClick={() => setVideoModalId(null)}
            style={{
              marginTop: "16px", background: "transparent", border: `1px solid ${T.border}`,
              borderRadius: "8px", color: T.muted, cursor: "pointer",
              fontSize: "13px", padding: "10px 24px", width: "100%",
            }}
          >
            Close — back to the test
          </button>
        </div>
      </div>
    );
  }

  return null;
}
