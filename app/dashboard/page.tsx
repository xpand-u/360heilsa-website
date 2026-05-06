import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

const SESSION_ICONS: Record<string, string> = {
  lifting: "🏋️",
  jits: "🥋",
  run: "🏃",
  hike: "🥾",
  rest: "💤",
  other: "📋",
};

const READINESS_COLORS: Record<string, string> = {
  green: "#4caf50",
  yellow: "#f5a623",
  red: "#e55",
  unknown: "var(--muted)",
};

const READINESS_LABELS: Record<string, string> = {
  green: "Grænt",
  yellow: "Gult",
  red: "Rautt",
  unknown: "Óþekkt",
};

function StatBox({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{ border: "1px solid var(--border)", padding: "20px 24px" }}>
      <p className="text-xs mb-2" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
        {label.toUpperCase()}
      </p>
      <p className="display" style={{ fontSize: "2rem", color: "var(--accent)" }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>{sub}</p>}
    </div>
  );
}

export default async function Dashboard() {
  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // Fetch all data in parallel
  const [nextSessionRes, weeklyStateRes, healthRes, blockRes] = await Promise.all([
    sb.from("next_session").select("*").eq("athlete_id", ATHLETE_ID).single(),
    sb.from("weekly_state").select("*").eq("athlete_id", ATHLETE_ID).order("week_start_date", { ascending: false }).limit(1).single(),
    sb.from("health_metrics").select("*").eq("athlete_id", ATHLETE_ID).eq("metric_date", today).maybeSingle(),
    sb.from("training_blocks").select("*").eq("athlete_id", ATHLETE_ID).eq("status", "active").maybeSingle(),
  ]);

  const session = nextSessionRes.data;
  const week = weeklyStateRes.data;
  const health = healthRes.data;
  const block = blockRes.data;

  // Week sessions from sessions table
  const sessionsRes = week
    ? await sb
        .table("sessions")
        .select("*")
        .eq("athlete_id", ATHLETE_ID)
        .gte("scheduled_date", week.week_start_date)
        .order("scheduled_date")
    : { data: [] };
  const weekSessions = sessionsRes.data || [];

  // Block deload countdown
  let deloadDays: number | null = null;
  if (block?.deload_due) {
    const diff = new Date(block.deload_due).getTime() - new Date(today).getTime();
    deloadDays = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  const readinessCall = health?.readiness_call || "unknown";
  const readinessColor = READINESS_COLORS[readinessCall];

  const todayFormatted = new Date().toLocaleDateString("is-IS", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{ background: "var(--background)", maxWidth: "900px", margin: "0 auto" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <p className="text-xs mb-1" style={{ color: "var(--muted)", letterSpacing: "0.15em" }}>
            360 HEILSA — MÆLABORÐ
          </p>
          <p className="display" style={{ fontSize: "1.6rem", color: "var(--foreground)", textTransform: "capitalize" }}>
            {todayFormatted}
          </p>
        </div>
        <a
          href="/"
          className="text-xs"
          style={{ color: "var(--muted)", textDecoration: "none" }}
        >
          ← Vefsíða
        </a>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div
          style={{
            border: "1px solid var(--border)",
            padding: "20px 24px",
            borderColor: readinessColor,
          }}
        >
          <p className="text-xs mb-2" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
            LÍÐAN
          </p>
          <p className="display" style={{ fontSize: "2rem", color: readinessColor }}>
            {READINESS_LABELS[readinessCall]}
          </p>
          {health?.ultrahuman_score && (
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Ultrahuman: {health.ultrahuman_score}
            </p>
          )}
        </div>

        <StatBox
          label="Svefn"
          value={health?.sleep_total_h ? `${health.sleep_total_h}h` : "—"}
        />

        <StatBox
          label="HRV"
          value={health?.hrv_sdnn ? `${health.hrv_sdnn}ms` : "—"}
          sub={health?.hrv_vs_baseline_pct != null ? `${health.hrv_vs_baseline_pct > 0 ? "+" : ""}${health.hrv_vs_baseline_pct}% frá grunnlínu` : undefined}
        />

        <StatBox
          label="Vika"
          value={`${week?.sessions_completed ?? 0}/${week?.sessions_planned ?? 0}`}
          sub={block ? `Vika ${Math.max(1, Math.ceil((new Date(today).getTime() - new Date(block.started_at).getTime()) / (1000 * 60 * 60 * 24 * 7)))} — ${block.name}` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Today's session */}
        <div style={{ border: "1px solid var(--border)", padding: "28px" }}>
          <p className="text-xs mb-4" style={{ color: "var(--muted)", letterSpacing: "0.15em" }}>
            NÆSTA ÆFING
          </p>
          {session ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <span style={{ fontSize: "1.6rem" }}>
                  {SESSION_ICONS[session.session_type] || "📋"}
                </span>
                <div>
                  <p
                    className="display"
                    style={{ fontSize: "1.3rem", color: "var(--foreground)", lineHeight: 1.2 }}
                  >
                    {session.session_label}
                  </p>
                  <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                    {new Date(session.planned_date + "T12:00:00").toLocaleDateString("is-IS", { weekday: "long", month: "long", day: "numeric" })}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 mb-5">
                {session.metadata?.expected_rpe && (
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>RPE</p>
                    <p style={{ color: "var(--accent)", fontWeight: 600 }}>{session.metadata.expected_rpe}</p>
                  </div>
                )}
                {session.metadata?.duration_target && (
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>Lengd</p>
                    <p style={{ color: "var(--foreground)" }}>{session.metadata.duration_target}</p>
                  </div>
                )}
                {session.metadata?.shoulder_risk && (
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>Öxl</p>
                    <p style={{ color: session.metadata.shoulder_risk === "high" ? "#e55" : session.metadata.shoulder_risk === "moderate" ? "#f5a623" : "#4caf50" }}>
                      {session.metadata.shoulder_risk}
                    </p>
                  </div>
                )}
                {session.metadata?.location && (
                  <div>
                    <p className="text-xs" style={{ color: "var(--muted)" }}>Staður</p>
                    <p style={{ color: "var(--foreground)" }}>{session.metadata.location}</p>
                  </div>
                )}
              </div>

              {session.content_md && (
                <div
                  className="text-sm leading-relaxed"
                  style={{
                    color: "var(--muted)",
                    borderTop: "1px solid var(--border)",
                    paddingTop: "16px",
                    whiteSpace: "pre-wrap",
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    maxHeight: "200px",
                    overflowY: "auto",
                  }}
                >
                  {session.content_md}
                </div>
              )}
            </>
          ) : (
            <p style={{ color: "var(--muted)" }}>Engin æfing skráð. Keyrðu sync script.</p>
          )}
        </div>

        {/* Week view */}
        <div style={{ border: "1px solid var(--border)", padding: "28px" }}>
          <p className="text-xs mb-4" style={{ color: "var(--muted)", letterSpacing: "0.15em" }}>
            ÞESSI VIKA
          </p>
          {weekSessions.length > 0 ? (
            <div className="space-y-3">
              {weekSessions.map((s: any) => {
                const isToday = s.scheduled_date === today;
                const isCompleted = s.status === "completed";
                const isMissed = s.status === "missed";
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 py-2"
                    style={{
                      borderLeft: isToday ? `2px solid var(--accent)` : "2px solid transparent",
                      paddingLeft: "10px",
                      opacity: isMissed ? 0.4 : 1,
                    }}
                  >
                    <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>
                      {SESSION_ICONS[s.session_type] || "📋"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        className="text-sm"
                        style={{
                          color: isToday ? "var(--accent)" : "var(--foreground)",
                          fontWeight: isToday ? 600 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {s.label}
                      </p>
                      <p className="text-xs" style={{ color: "var(--muted)" }}>
                        {new Date(s.scheduled_date + "T12:00:00").toLocaleDateString("is-IS", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                      {isCompleted ? "✓" : isMissed ? "✗" : "·"}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--muted)" }}>Engar æfingar skráðar. Keyrðu sync script.</p>
          )}
        </div>
      </div>

      {/* Block info */}
      {block && (
        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-5 px-6"
          style={{ border: "1px solid var(--border)" }}
        >
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--muted)", letterSpacing: "0.12em" }}>
              ÞJÁLFUNARBLOKK
            </p>
            <p className="display" style={{ fontSize: "1.2rem", color: "var(--foreground)" }}>
              {block.name}
            </p>
          </div>
          {deloadDays !== null && (
            <div className="text-right">
              <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>DELOAD ÁÐ</p>
              <p
                className="display"
                style={{
                  fontSize: "1.4rem",
                  color: deloadDays <= 7 ? "#f5a623" : "var(--accent)",
                }}
              >
                {deloadDays} {deloadDays === 1 ? "dagur" : "dagar"}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <p className="text-xs mt-8 text-center" style={{ color: "var(--muted)" }}>
        Síðast uppfært úr vault: keyrðu{" "}
        <code style={{ color: "var(--accent)" }}>python3 scripts/sync_to_supabase.py</code>
      </p>
    </div>
  );
}
