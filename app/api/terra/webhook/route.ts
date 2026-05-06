/**
 * Terra webhook receiver.
 * Terra POSTs health data here automatically after each sync.
 *
 * Set this URL in the Terra dashboard:
 *   https://360heilsa.is/api/terra/webhook
 *
 * Handles event types:
 *   auth    — new connection established, store terra_user_id → athlete_id
 *   sleep   — HRV, sleep stages, RHR → health_metrics
 *   daily   — steps, active energy, RHR → health_metrics
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Service-role client (bypasses RLS — needed for webhook ingest)
function sb() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

// ─── Signature verification ───────────────────────────────────────────────────

function verifySignature(body: string, header: string | null): boolean {
  const secret = process.env.TERRA_WEBHOOK_SECRET;
  if (!secret || !header) return !secret; // skip if no secret configured
  // Format: "t=TIMESTAMP,v1=SIGNATURE"
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateStr(isoStr: string): string {
  return isoStr.slice(0, 10);
}

/** Sleep end time = the morning date to attribute data to */
function sleepMorningDate(endTime: string): string {
  return toDateStr(endTime);
}

function avg(arr: number[]): number | null {
  if (!arr.length) return null;
  return Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10;
}

function computeReadiness(
  hrv: number | null,
  baseline: number | null
): "green" | "yellow" | "red" | "unknown" {
  if (!hrv) return "unknown";
  if (!baseline) {
    if (hrv >= 55) return "green";
    if (hrv >= 38) return "yellow";
    return "red";
  }
  const pct = (hrv - baseline) / baseline;
  if (pct >= 0.05)  return "green";
  if (pct >= -0.08) return "yellow";
  return "red";
}

// ─── Athlete lookup ───────────────────────────────────────────────────────────

async function getAthleteId(
  db: ReturnType<typeof sb>,
  terraUserId: string,
  referenceId?: string
): Promise<string | null> {
  // Primary: look up via terra_connections
  const { data } = await db
    .from("terra_connections")
    .select("athlete_id")
    .eq("terra_user_id", terraUserId)
    .eq("is_active", true)
    .maybeSingle();
  if (data?.athlete_id) return data.athlete_id;

  // Fallback: reference_id is our athlete UUID (set during widget session creation)
  if (referenceId) return referenceId;

  return null;
}

// ─── HRV baseline lookup ──────────────────────────────────────────────────────

async function getHrvBaseline(
  db: ReturnType<typeof sb>,
  athleteId: string,
  beforeDate: string
): Promise<{ baseline30d: number | null; avg7d: number | null }> {
  const d30 = new Date(beforeDate);
  d30.setDate(d30.getDate() - 30);
  const d7 = new Date(beforeDate);
  d7.setDate(d7.getDate() - 7);

  const { data } = await db
    .from("health_metrics")
    .select("metric_date,hrv_sdnn")
    .eq("athlete_id", athleteId)
    .gte("metric_date", d30.toISOString().slice(0, 10))
    .lt("metric_date", beforeDate)
    .not("hrv_sdnn", "is", null);

  if (!data?.length) return { baseline30d: null, avg7d: null };
  const all = data.map((r: any) => r.hrv_sdnn as number);
  const last7 = data
    .filter((r: any) => r.metric_date >= d7.toISOString().slice(0, 10))
    .map((r: any) => r.hrv_sdnn as number);
  return {
    baseline30d: avg(all),
    avg7d: avg(last7.length >= 3 ? last7 : all),
  };
}

// ─── Upsert health metrics ────────────────────────────────────────────────────

async function upsertHealth(
  db: ReturnType<typeof sb>,
  athleteId: string,
  date: string,
  fields: Record<string, unknown>
) {
  const row = {
    athlete_id:  athleteId,
    metric_date: date,
    updated_at:  new Date().toISOString(),
    ...fields,
  };
  // Strip nulls to avoid overwriting existing data on partial updates
  const clean = Object.fromEntries(Object.entries(row).filter(([, v]) => v != null));
  await db
    .from("health_metrics")
    .upsert(clean, { onConflict: "athlete_id,metric_date" });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleAuth(db: ReturnType<typeof sb>, user: any) {
  const { user_id, provider, reference_id } = user;
  if (!reference_id) return; // can't map without athlete id

  await db.from("terra_connections").upsert(
    {
      athlete_id:    reference_id,
      terra_user_id: user_id,
      provider,
      connected_at:  new Date().toISOString(),
      is_active:     true,
      updated_at:    new Date().toISOString(),
    },
    { onConflict: "terra_user_id" }
  );
}

async function handleSleep(
  db: ReturnType<typeof sb>,
  athleteId: string,
  records: any[]
) {
  for (const record of records) {
    const endTime = record.metadata?.end_time;
    if (!endTime) continue;
    const date = sleepMorningDate(endTime);

    const sleep   = record.sleep_durations_data ?? {};
    const asleep  = sleep.asleep ?? {};
    const awake   = sleep.awake ?? {};
    const hrv     = record.hrv_data?.summary ?? {};
    const hr      = record.heart_rate_data?.summary ?? {};

    const deepH  = asleep.duration_deep_sleep_state_seconds  ? asleep.duration_deep_sleep_state_seconds  / 3600 : null;
    const remH   = asleep.duration_REM_sleep_state_seconds   ? asleep.duration_REM_sleep_state_seconds   / 3600 : null;
    const lightH = asleep.duration_light_sleep_state_seconds ? asleep.duration_light_sleep_state_seconds / 3600 : null;
    const awakeH = awake.duration_awake_state_seconds        ? awake.duration_awake_state_seconds        / 3600 : null;

    const totalH = (deepH ?? 0) + (remH ?? 0) + (lightH ?? 0);

    const hrvSdnn    = hrv.avg_sdnn_ms ?? hrv.avg_hrv ?? null;
    const restingHr  = hr.resting_hr_bpm ?? null;

    const { baseline30d, avg7d } = await getHrvBaseline(db, athleteId, date);
    const pct = hrvSdnn && baseline30d
      ? Math.round(((hrvSdnn - baseline30d) / baseline30d) * 1000) / 10
      : null;

    await upsertHealth(db, athleteId, date, {
      hrv_sdnn:            hrvSdnn,
      hrv_7d_avg:          avg7d,
      hrv_30d_baseline:    baseline30d,
      hrv_vs_baseline_pct: pct,
      resting_hr:          restingHr ? Math.round(restingHr) : null,
      sleep_total_h:       totalH > 0 ? Math.round(totalH * 10) / 10 : null,
      sleep_deep_h:        deepH  ? Math.round(deepH  * 10) / 10 : null,
      sleep_rem_h:         remH   ? Math.round(remH   * 10) / 10 : null,
      sleep_core_h:        lightH ? Math.round(lightH * 10) / 10 : null,
      sleep_awake_h:       awakeH ? Math.round(awakeH * 10) / 10 : null,
      readiness_call:      computeReadiness(hrvSdnn, baseline30d),
    });
  }
}

async function handleDaily(
  db: ReturnType<typeof sb>,
  athleteId: string,
  records: any[]
) {
  for (const record of records) {
    const startTime = record.metadata?.start_time;
    if (!startTime) continue;
    const date = toDateStr(startTime);

    const hr      = record.heart_rate_data?.summary ?? {};
    const cals    = record.calories_data ?? {};

    await upsertHealth(db, athleteId, date, {
      steps:              record.steps ?? null,
      active_energy_kcal: cals.net_activity_calories ?? cals.total_burned_calories ?? null,
      exercise_min:       record.active_durations_data?.activity_seconds
                            ? Math.round(record.active_durations_data.activity_seconds / 60)
                            : null,
      resting_hr:         hr.resting_hr_bpm ? Math.round(hr.resting_hr_bpm) : null,
    });
  }
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig     = req.headers.get("terra-signature");

  if (!verifySignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, user, data, status } = payload;

  // Terra sends test pings — acknowledge but don't process
  if (status === "error" || !user) {
    return NextResponse.json({ ok: true });
  }

  const db = sb();

  try {
    if (type === "auth") {
      await handleAuth(db, user);
      return NextResponse.json({ ok: true });
    }

    const athleteId = await getAthleteId(db, user.user_id, user.reference_id);
    if (!athleteId) {
      console.warn(`Terra webhook: no athlete found for terra_user_id=${user.user_id}`);
      return NextResponse.json({ ok: true }); // 200 so Terra doesn't retry
    }

    // Update last_sync timestamp
    await db
      .from("terra_connections")
      .update({ last_sync: new Date().toISOString() })
      .eq("terra_user_id", user.user_id);

    const records = Array.isArray(data) ? data : [data];

    if (type === "sleep")  await handleSleep(db, athleteId, records);
    if (type === "daily")  await handleDaily(db, athleteId, records);

    return NextResponse.json({ ok: true, type, athlete: athleteId });
  } catch (err) {
    console.error("Terra webhook error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
