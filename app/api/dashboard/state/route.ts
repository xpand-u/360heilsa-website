import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

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
  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  // Get Monday of current week
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const weekStart = monday.toISOString().split("T")[0];

  const [nextSessionRes, weeklyStateRes, healthRes, blockRes, limitationsRes] =
    await Promise.all([
      sb.from("next_session").select("*").eq("athlete_id", ATHLETE_ID).maybeSingle(),
      sb.from("weekly_state").select("*").eq("athlete_id", ATHLETE_ID)
        .order("week_start_date", { ascending: false }).limit(1).maybeSingle(),
      sb.from("health_metrics").select("*").eq("athlete_id", ATHLETE_ID)
        .eq("metric_date", today).maybeSingle(),
      sb.from("training_blocks").select("*").eq("athlete_id", ATHLETE_ID)
        .eq("status", "active").maybeSingle(),
      sb.from("limitations").select("*").eq("athlete_id", ATHLETE_ID)
        .neq("status", "resolved"),
    ]);

  // Week sessions
  const sessionsRes = await sb.from("sessions").select("*")
    .eq("athlete_id", ATHLETE_ID)
    .gte("scheduled_date", weekStart)
    .order("scheduled_date");

  // Recent session logs (last 10)
  const logsRes = await sb.from("session_logs").select("*")
    .eq("athlete_id", ATHLETE_ID)
    .order("log_date", { ascending: false })
    .limit(10);

  // Today's scratch
  const scratchRes = await sb.from("session_scratch").select("*")
    .eq("athlete_id", ATHLETE_ID)
    .eq("scratch_date", today)
    .eq("scratch_status", "active")
    .maybeSingle();

  // Health metrics last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const healthHistRes = await sb.from("health_metrics").select("*")
    .eq("athlete_id", ATHLETE_ID)
    .gte("metric_date", thirtyDaysAgo.toISOString().split("T")[0])
    .order("metric_date");

  const session = nextSessionRes.data;
  const week = weeklyStateRes.data;
  const block = blockRes.data;

  // If no health data for today, fall back to most recent row
  let health = healthRes.data;
  let healthDate = today;
  if (!health) {
    const fallbackRes = await sb.from("health_metrics")
      .select("*").eq("athlete_id", ATHLETE_ID)
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
  const rhrRecs = healthHistory.filter((r) => r.resting_hr);
  const hrvRecs = healthHistory.filter((r) => r.hrv_sdnn);

  const avg = (arr: number[]) =>
    arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0;

  const sleep7d = avg(sleepRecs.slice(-7).map((r) => r.sleep_total_h));
  const sleep30d = avg(sleepRecs.map((r) => r.sleep_total_h));

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
    block: block
      ? {
          ...block,
          week: blockWeek(block.started_at),
          deloadDays: daysUntil(block.deload_due),
        }
      : null,
    limitations,
    recentLogs,
    scratch,
    insights: {
      sleep7d,
      sleep30d,
      currentRhr: rhrRecs.length ? rhrRecs[rhrRecs.length - 1].resting_hr : null,
      avgRhr30d: avg(rhrRecs.map((r) => r.resting_hr)),
      currentHrv: hrvRecs.length ? hrvRecs[hrvRecs.length - 1].hrv_sdnn : null,
      avgHrv30d: avg(hrvRecs.map((r) => r.hrv_sdnn)),
      sleepLabels: sleepRecs.map((r) => r.metric_date.slice(5)),
      sleepTotals: sleepRecs.map((r) => r.sleep_total_h),
      rhrLabels: rhrRecs.map((r) => r.metric_date.slice(5)),
      rhrValues: rhrRecs.map((r) => r.resting_hr),
    },
  });
}
