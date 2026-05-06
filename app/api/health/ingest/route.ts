/**
 * Health Auto Export webhook ingest endpoint.
 *
 * Configure Health Auto Export:
 *   Export type: REST API
 *   URL: https://360heilsa.is/api/health/ingest
 *   Method: POST
 *   Headers: Authorization: Bearer <HEALTH_INGEST_SECRET>
 *   Data type: JSON
 *   Metrics to include: Heart Rate Variability (SDNN), Resting Heart Rate,
 *     Sleep Analysis, Step Count, Active Energy, Apple Exercise Time
 *   Automation: run every morning after wake-up
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;
const INGEST_SECRET = process.env.HEALTH_INGEST_SECRET!;

// ─── Types ────────────────────────────────────────────────────────────────────

interface HaeEntry {
  date: string;       // "YYYY-MM-DD HH:mm:ss ±HHMM" or "YYYY-MM-DD"
  qty?: number;
  Avg?: number;
  Max?: number;
  Min?: number;
  value?: string;     // sleep stage label
  source?: string;
}

interface HaeMetric {
  name: string;
  units: string;
  data: HaeEntry[];
}

// Accumulated fields per calendar date before upsert
interface DayAccumulator {
  hrv_values:       number[];
  resting_hr:       number | null;
  sleep_deep_h:     number;
  sleep_rem_h:      number;
  sleep_core_h:     number;
  sleep_awake_h:    number;
  steps:            number | null;
  active_energy_kcal: number | null;
  exercise_min:     number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract YYYY-MM-DD from any date string Health Auto Export produces. */
function toDateStr(raw: string): string {
  return raw.slice(0, 10);
}

/**
 * Sleep segment attribution: attribute a sleep segment to the date the person
 * woke up. If the segment starts at or after 18:00 (6pm), it belongs to the
 * NEXT calendar day (i.e. the morning they woke up). Otherwise keep the date.
 */
function sleepDate(raw: string): string {
  const d = toDateStr(raw);
  const timeStr = raw.slice(11, 16); // "HH:MM"
  if (!timeStr) return d;
  const [hh] = timeStr.split(":").map(Number);
  if (hh >= 18) {
    const next = new Date(`${d}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    return next.toISOString().slice(0, 10);
  }
  return d;
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

function computeReadiness(
  hrvToday: number | null,
  baseline30d: number | null
): "green" | "yellow" | "red" | "unknown" {
  if (!hrvToday) return "unknown";
  if (!baseline30d) {
    // No baseline yet — use generic absolute bands
    if (hrvToday >= 55) return "green";
    if (hrvToday >= 38) return "yellow";
    return "red";
  }
  const pct = (hrvToday - baseline30d) / baseline30d;
  if (pct >= 0.05)  return "green";
  if (pct >= -0.08) return "yellow";
  return "red";
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!INGEST_SECRET || token !== INGEST_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Health Auto Export wraps metrics in data.metrics or just metrics at root
  const metrics: HaeMetric[] =
    body?.data?.metrics ?? body?.metrics ?? [];

  if (!Array.isArray(metrics) || metrics.length === 0) {
    return NextResponse.json({ ok: true, inserted: 0, message: "No metrics" });
  }

  // ── Accumulate by date ──────────────────────────────────────────────────────
  const days: Record<string, DayAccumulator> = {};

  const getDay = (d: string): DayAccumulator => {
    if (!days[d]) {
      days[d] = {
        hrv_values: [], resting_hr: null,
        sleep_deep_h: 0, sleep_rem_h: 0, sleep_core_h: 0, sleep_awake_h: 0,
        steps: null, active_energy_kcal: null, exercise_min: null,
      };
    }
    return days[d];
  };

  for (const metric of metrics) {
    const name = metric.name?.toLowerCase();

    for (const entry of metric.data ?? []) {
      const qty = entry.qty ?? entry.Avg ?? null;

      if (name === "heart_rate_variability_sdnn") {
        const d = toDateStr(entry.date);
        if (qty != null) getDay(d).hrv_values.push(qty);

      } else if (name === "resting_heart_rate") {
        const d = toDateStr(entry.date);
        if (qty != null) getDay(d).resting_hr = Math.round(qty);

      } else if (name === "sleep_analysis") {
        // Attribute to wake-up date
        const d = sleepDate(entry.date);
        const stage = (entry.value ?? "").toLowerCase();
        const h = qty ?? 0;
        if (stage === "deep")                        getDay(d).sleep_deep_h  += h;
        else if (stage === "rem")                    getDay(d).sleep_rem_h   += h;
        else if (["core", "light"].includes(stage))  getDay(d).sleep_core_h  += h;
        else if (stage === "awake" || stage === "inbed") getDay(d).sleep_awake_h += h;
        // "asleep" (older HealthKit) — split evenly into core
        else if (stage === "asleep")                 getDay(d).sleep_core_h  += h;

      } else if (name === "step_count") {
        const d = toDateStr(entry.date);
        if (qty != null) getDay(d).steps = ((getDay(d).steps ?? 0) + Math.round(qty));

      } else if (name === "active_energy") {
        const d = toDateStr(entry.date);
        if (qty != null)
          getDay(d).active_energy_kcal =
            Math.round(((getDay(d).active_energy_kcal ?? 0) + qty) * 10) / 10;

      } else if (name === "apple_exercise_time") {
        const d = toDateStr(entry.date);
        if (qty != null)
          getDay(d).exercise_min =
            Math.round((getDay(d).exercise_min ?? 0) + qty);
      }
    }
  }

  const sb = createServerClient();
  const dates = Object.keys(days).sort();
  let inserted = 0;

  for (const date of dates) {
    const day = days[date];
    const hrvToday = avg(day.hrv_values);

    // Fetch historical HRV for baseline computation
    let hrv7dAvg: number | null = null;
    let hrv30dBaseline: number | null = null;
    let hrvVsBaselinePct: number | null = null;

    if (hrvToday != null) {
      const since30 = new Date(date);
      since30.setDate(since30.getDate() - 30);
      const since7 = new Date(date);
      since7.setDate(since7.getDate() - 7);

      const { data: hist } = await sb
        .from("health_metrics")
        .select("metric_date,hrv_sdnn")
        .eq("athlete_id", ATHLETE_ID)
        .gte("metric_date", since30.toISOString().slice(0, 10))
        .lt("metric_date", date)
        .not("hrv_sdnn", "is", null);

      if (hist && hist.length > 0) {
        const all30 = hist.map((r: any) => r.hrv_sdnn as number);
        const last7 = hist
          .filter((r: any) => r.metric_date >= since7.toISOString().slice(0, 10))
          .map((r: any) => r.hrv_sdnn as number);

        hrv30dBaseline = avg(all30);
        hrv7dAvg       = avg(last7.length >= 3 ? last7 : all30);
        if (hrv30dBaseline) {
          hrvVsBaselinePct =
            Math.round(((hrvToday - hrv30dBaseline) / hrv30dBaseline) * 1000) / 10;
        }
      }
    }

    const readiness = computeReadiness(hrvToday, hrv30dBaseline);
    const sleepTotal =
      Math.round(
        (day.sleep_deep_h + day.sleep_rem_h + day.sleep_core_h) * 10
      ) / 10 || null;

    const row: Record<string, unknown> = {
      athlete_id:          ATHLETE_ID,
      metric_date:         date,
      hrv_sdnn:            hrvToday,
      hrv_7d_avg:          hrv7dAvg,
      hrv_30d_baseline:    hrv30dBaseline,
      hrv_vs_baseline_pct: hrvVsBaselinePct,
      resting_hr:          day.resting_hr,
      sleep_total_h:       sleepTotal,
      sleep_deep_h:        day.sleep_deep_h  || null,
      sleep_rem_h:         day.sleep_rem_h   || null,
      sleep_core_h:        day.sleep_core_h  || null,
      sleep_awake_h:       day.sleep_awake_h || null,
      steps:               day.steps,
      active_energy_kcal:  day.active_energy_kcal,
      exercise_min:        day.exercise_min,
      readiness_call:      readiness,
      updated_at:          new Date().toISOString(),
    };

    // Strip nulls so we don't overwrite existing data with nulls on partial syncs
    const cleanRow = Object.fromEntries(
      Object.entries(row).filter(([, v]) => v != null)
    );

    const { error } = await sb
      .from("health_metrics")
      .upsert(cleanRow, { onConflict: "athlete_id,metric_date" });

    if (!error) inserted++;
  }

  return NextResponse.json({ ok: true, inserted, dates });
}
