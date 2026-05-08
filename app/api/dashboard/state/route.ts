import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { computeCyclePhase } from "@/app/api/cycle/log/route";
import { getAthleteId } from "@/lib/get-athlete-id";


function daysUntil(dateStr: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function blockWeek(startedAt: string): number {
  if (!startedAt) return 1;
  const diff = new Date().getTime() - new Date(startedAt).getTime();
  return Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24 * 7)));
}

export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // Get Monday of current week
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekStart = monday.toISOString().split("T")[0];

  const [nextSessionRes, weeklyStateRes, healthRes, blockRes, limitationsRes, athleteRes] =
    await Promise.all([
      sb.from("next_session").select("*").eq("athlete_id", athleteId).maybeSingle(),
      sb.from("weekly_state").select("*").eq("athlete_id", athleteId)
        .order("week_start_date", { ascending: false }).limit(1).maybeSingle(),
      sb.from("health_metrics").select("*").eq("athlete_id", athleteId)
        .eq("metric_date", today).maybeSingle(),
      sb.from("training_blocks").select("*").eq("athlete_id", athleteId)
        .eq("status", "active").maybeSingle(),
      sb.from("limitations").select("*").eq("athlete_id", athleteId)
        .neq("status", "resolved"),
      sb.from("athletes").select("full_name, goals, onboarding_complete, onboarding_completed_at, tracks_cycle, avg_cycle_length")
        .eq("id", athleteId).single(),
    ]);

  // Week sessions
  const sessionsRes = await sb.from("sessions").select("*")
    .eq("athlete_id", athleteId)
    .gte("scheduled_date", weekStart)
    .order("scheduled_date");

  // Recent session logs (last 20)
  const logsRes = await sb.from("session_logs").select("*")
    .eq("athlete_id", athleteId)
    .order("log_date", { ascending: false })
    .limit(20);

  // Today's scratch
  const scratchRes = await sb.from("session_scratch").select("*")
    .eq("athlete_id", athleteId)
    .eq("scratch_date", today)
    .eq("scratch_status", "active")
    .maybeSingle();

  // Health metrics last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const healthHistRes = await sb.from("health_metrics").select("*")
    .eq("athlete_id", athleteId)
    .gte("metric_date", ninetyDaysAgo.toISOString().split("T")[0])
    .order("metric_date");

  const session  = nextSessionRes.data;
  const week     = weeklyStateRes.data;
  const block    = blockRes.data;
  const athlete  = athleteRes.data;

  // If no health data for today, fall back to most recent row
  let health = healthRes.data;
  let healthDate = today;
  if (!health) {
    const fallbackRes = await sb.from("health_metrics")
      .select("*").eq("athlete_id", athleteId)
      .order("metric_date", { ascending: false })
      .limit(1).maybeSingle();
    health = fallbackRes.data;
    healthDate = fallbackRes.data?.metric_date || today;
  }
  const limitations = limitationsRes.data || [];
  const weekSessions = sessionsRes.data || [];
  const recentLogs = logsRes.data || [];
  const scratch = scratchRes.data;
  const healthHistory = healthHistRes.data || [];

  // Compute insights from health history
  const sleepRecs = healthHistory.filter((r) => r.sleep_total_h);
  const rhrRecs   = healthHistory.filter((r) => r.resting_hr);
  const hrvRecs   = healthHistory.filter((r) => r.hrv_sdnn);
  const stepRecs  = healthHistory.filter((r) => r.steps);

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  const sleep7d  = avg(sleepRecs.slice(-7).map((r) => r.sleep_total_h));
  const sleep30d = avg(sleepRecs.map((r) => r.sleep_total_h));
  const steps7d  = Math.round(avg(stepRecs.slice(-7).map((r) => r.steps)));

  // Block completion check
  let blockComplete = false;
  let blockSessionsCompleted = 0;
  let blockSessionsTotal = 0;
  if (block) {
    const weeksPassed = Math.floor(
      (Date.now() - new Date(block.started_at).getTime()) / (1000 * 60 * 60 * 24 * 7)
    );
    const { count: done } = await sb.from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .eq("block_id", block.id)
      .eq("status", "completed");
    const { count: allSess } = await sb.from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("athlete_id", athleteId)
      .eq("block_id", block.id);
    blockSessionsCompleted = done ?? 0;
    blockSessionsTotal = allSess ?? 0;
    blockComplete = weeksPassed >= block.planned_weeks ||
      (blockSessionsTotal > 0 && blockSessionsCompleted >= blockSessionsTotal);
  }

  // Cycle phase
  let cyclePhase = null;
  if (athlete?.tracks_cycle) {
    const { data: latestCycle } = await sb
      .from("cycle_logs")
      .select("period_start_date")
      .eq("athlete_id", athleteId)
      .order("period_start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestCycle?.period_start_date) {
      cyclePhase = computeCyclePhase(
        latestCycle.period_start_date,
        athlete.avg_cycle_length || 28
      );
    }
  }

  return NextResponse.json({
    today,
    healthDate,
    todayStr: new Date().toLocaleDateString("en-GB", {
      weekday: "long", month: "long", day: "numeric",
    }),
    session,
    week,
    weekSessions,
    health,
    healthHistory,
    athlete: {
      fullName: athlete?.full_name,
      goals:    athlete?.goals,
      onboardingComplete: athlete?.onboarding_complete,
      tracksCycle: athlete?.tracks_cycle || false,
      cyclePhase,
    },
    block: block
      ? {
          ...block,
          week: blockWeek(block.started_at),
          deloadDays: daysUntil(block.deload_due),
          blockComplete,
          blockSessionsCompleted,
          blockSessionsTotal,
        }
      : null,
    limitations,
    recentLogs,
    scratch,
    insights: {
      sleep7d,
      sleep30d,
      steps7d,
      currentRhr: rhrRecs.length ? rhrRecs[rhrRecs.length - 1].resting_hr : null,
      avgRhr30d: avg(rhrRecs.map((r) => r.resting_hr)),
      currentHrv: hrvRecs.length ? hrvRecs[hrvRecs.length - 1].hrv_sdnn : null,
      avgHrv30d: avg(hrvRecs.map((r) => r.hrv_sdnn)),
      sleepLabels: sleepRecs.map((r) => r.metric_date.slice(5)),
      sleepTotals: sleepRecs.map((r) => r.sleep_total_h),
      rhrLabels: rhrRecs.map((r) => r.metric_date.slice(5)),
      rhrValues: rhrRecs.map((r) => r.resting_hr),
      stepLabels: stepRecs.map((r) => r.metric_date.slice(5)),
      stepValues: stepRecs.map((r) => r.steps),
    },
  });
}
