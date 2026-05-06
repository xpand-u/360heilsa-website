import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function POST(req: NextRequest) {
  const { readiness_call, hrv_sdnn, sleep_total_h, resting_hr, notes } =
    await req.json();

  if (!readiness_call) {
    return NextResponse.json({ error: "readiness_call required" }, { status: 400 });
  }

  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const row: Record<string, unknown> = {
    athlete_id:    ATHLETE_ID,
    metric_date:   today,
    readiness_call,
    updated_at:    new Date().toISOString(),
  };

  if (hrv_sdnn != null && hrv_sdnn !== "")      row.hrv_sdnn      = Number(hrv_sdnn);
  if (sleep_total_h != null && sleep_total_h !== "") row.sleep_total_h = Number(sleep_total_h);
  if (resting_hr != null && resting_hr !== "")  row.resting_hr    = Number(resting_hr);
  if (notes?.trim())                            row.notes         = notes.trim();

  const { error } = await sb
    .from("health_metrics")
    .upsert(row, { onConflict: "athlete_id,metric_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
