import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";


export async function POST(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { note } = await req.json();
  if (!note?.trim()) return NextResponse.json({ error: "empty" }, { status: 400 });

  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];
  const time = new Date().toLocaleTimeString("is-IS", { hour: "2-digit", minute: "2-digit" });

  // Get or create today's scratch
  const existing = await sb.from("session_scratch").select("*")
    .eq("athlete_id", athleteId)
    .eq("scratch_date", today)
    .eq("scratch_status", "active")
    .maybeSingle();

  const entry = { time, note: note.trim() };

  if (existing.data) {
    const entries = [...(existing.data.entries || []), entry];
    await sb.from("session_scratch").update({ entries, last_updated: new Date().toISOString() })
      .eq("id", existing.data.id);
    return NextResponse.json({ ok: true, entries });
  } else {
    // Get current session label
    const sessionRes = await sb.from("next_session").select("session_label")
      .eq("athlete_id", athleteId).maybeSingle();
    const label = sessionRes.data?.session_label || "Session";

    const { data } = await sb.from("session_scratch").insert({
      athlete_id: athleteId,
      scratch_date: today,
      session_label: label,
      entries: [entry],
      started_at: new Date().toISOString(),
      scratch_status: "active",
    }).select().single();

    return NextResponse.json({ ok: true, entries: data?.entries || [entry] });
  }
}

export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await sb.from("session_scratch").select("*")
    .eq("athlete_id", athleteId)
    .eq("scratch_date", today)
    .eq("scratch_status", "active")
    .maybeSingle();

  return NextResponse.json({ entries: data?.entries || [], label: data?.session_label || "" });
}
