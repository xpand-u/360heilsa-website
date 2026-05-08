import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase-server";
import { computeCyclePhase } from "@/app/api/cycle/log/route";
import { getAthleteId } from "@/lib/get-athlete-id";


export async function POST(_req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const [athleteRes, sessionRes, healthRes, blockRes, weekRes, limitRes] =
    await Promise.all([
      sb
        .from("athletes")
        .select("full_name, goals, training_schedule, onboarding_data, tracks_cycle, avg_cycle_length")
        .eq("id", athleteId)
        .single(),
      sb
        .from("next_session")
        .select("*")
        .eq("athlete_id", athleteId)
        .maybeSingle(),
      sb
        .from("health_metrics")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("metric_date", today)
        .maybeSingle(),
      sb
        .from("training_blocks")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("status", "active")
        .maybeSingle(),
      sb
        .from("weekly_state")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("week_start_date", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb
        .from("limitations")
        .select("*")
        .eq("athlete_id", athleteId)
        .neq("status", "resolved"),
    ]);

  // Health fallback to most recent if today missing
  let health = healthRes.data;
  let healthDate = today;
  if (!health) {
    const fallback = await sb
      .from("health_metrics")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("metric_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    health = fallback.data;
    healthDate = fallback.data?.metric_date || today;
  }

  // Last 7 days health for trend
  const sevenAgo = new Date();
  sevenAgo.setDate(sevenAgo.getDate() - 7);
  const trendRes = await sb
    .from("health_metrics")
    .select("metric_date,hrv_sdnn,sleep_total_h,resting_hr,readiness_call")
    .eq("athlete_id", athleteId)
    .gte("metric_date", sevenAgo.toISOString().split("T")[0])
    .order("metric_date");

  const athlete = athleteRes.data;
  const session = sessionRes.data;
  const block = blockRes.data;
  const week = weekRes.data;
  const limitations = limitRes.data || [];
  const trend = trendRes.data || [];

  // Cycle phase (only if athlete tracks cycle)
  let cycleContext = "";
  if (athlete?.tracks_cycle) {
    const { data: cycleLog } = await sb
      .from("cycle_logs")
      .select("period_start_date, cycle_length_est")
      .eq("athlete_id", athleteId)
      .order("period_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (cycleLog?.period_start_date) {
      const phase = computeCyclePhase(
        cycleLog.period_start_date,
        athlete.avg_cycle_length || 28
      );
      cycleContext = `\nCYCLE PHASE: ${phase.label} (Day ${phase.day}) — ${phase.trainingNote}`;
    }
  }

  // Recent PRs (last 3 days)
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const { data: recentLogs } = await sb
    .from("session_logs")
    .select("top_sets, log_date")
    .eq("athlete_id", athleteId)
    .gte("log_date", threeDaysAgo.toISOString().split("T")[0])
    .order("log_date", { ascending: false })
    .limit(3);

  // We can't run PR detection here without the full history — just surface recent top sets
  const recentTopSets = (recentLogs || []).flatMap(l =>
    (l.top_sets || []).filter((s: any) => s.load_kg && s.exercise)
      .map((s: any) => `${s.exercise} ${s.load_kg}kg ${s.sets || "?"}×${s.reps || "?"}`)
  ).slice(0, 4).join(", ");

  const weekNum = block
    ? Math.max(
        1,
        Math.ceil(
          (Date.now() - new Date(block.started_at).getTime()) /
            (1000 * 60 * 60 * 24 * 7)
        )
      )
    : null;

  const athleteName = athlete?.full_name || "Athlete";
  const athleteGoals = athlete?.goals || athlete?.onboarding_data?.goals || "Not specified";
  const trainingSchedule = athlete?.training_schedule
    ? `Training days: ${Object.entries(athlete.training_schedule as Record<string, { type: string; time?: string }>)
        .filter(([, v]) => v?.type)
        .map(([day, v]) => `${day} (${v.type}${v.time ? ` @ ${v.time}` : ""})`)
        .join(", ")}`
    : "Schedule not set";

  const prompt = `Generate a concise morning training brief for ${athleteName} (${today}).

ATHLETE PROFILE:
- Goals: ${athleteGoals}
- ${trainingSchedule}

READINESS${healthDate !== today ? ` (from ${healthDate})` : ""}:
- Status: ${health?.readiness_call || "unknown"}
- HRV: ${health?.hrv_sdnn ?? "—"}ms
- Sleep: ${health?.sleep_total_h ?? "—"}h
- RHR: ${health?.resting_hr ?? "—"}bpm
- Recovery score: ${health?.ultrahuman_score ?? "—"}
- Notes: ${health?.notes || "none"}

7-DAY TREND:
${trend.map((r: any) => `${r.metric_date}: ${r.readiness_call || "—"} | HRV ${r.hrv_sdnn ?? "—"} | Sleep ${r.sleep_total_h ?? "—"}h`).join("\n") || "No trend data"}

TODAY'S SESSION:
${session ? `${session.session_label} (${session.session_type})\n${session.content_md?.slice(0, 600)}` : "No session scheduled"}

BLOCK: ${block ? `${block.name}, vika ${weekNum} af ${block.planned_weeks}` : "None"}
WEEK: ${week ? `${week.sessions_completed}/${week.sessions_planned} lokið` : "No data"}
ACTIVE LIMITATIONS: ${limitations.length > 0 ? limitations.map((l: any) => `${l.limitation_type}: ${l.status}`).join(", ") : "None"}
${cycleContext}${recentTopSets ? `\nRECENT TRAINING (last 3 days): ${recentTopSets}` : ""}

Write a focused morning brief (4–6 bullet points). Include:
1. Go / modify / rest call — be decisive based on readiness + trend
2. Specific load guidance if modifying (e.g. "cut working sets by 1, drop intensity by 10%")
3. Key focus cues for the session (1-2 technical priorities)
4. Any flags: shoulder risk, deload proximity, sleep debt${cycleContext ? ", cycle phase considerations" : ""}
5. One sharp motivational line at the end

${cycleContext ? "If in late luteal or menstrual phase: weave that context naturally into the readiness call — don't make it awkward, just factor it in." : ""}
No fluff. Direct. All in English.`;

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 600,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
      } catch {
        controller.enqueue(encoder.encode("Villa við að búa til dagskrá."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
