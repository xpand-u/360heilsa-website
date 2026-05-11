/**
 * GET /api/onboarding/calendar-token
 * Returns the athlete's calendar token, generating one if it doesn't exist yet.
 * Called during the schedule step so the sync button works before full save.
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";
import crypto from "crypto";

export async function GET() {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = createServerClient();

  const { data } = await sb
    .from("athletes")
    .select("calendar_token")
    .eq("id", athleteId)
    .single();

  let token = data?.calendar_token;

  if (!token) {
    token = crypto.randomBytes(16).toString("hex");
    await sb.from("athletes").update({ calendar_token: token }).eq("id", athleteId);
  }

  return NextResponse.json({ calendarToken: token });
}
