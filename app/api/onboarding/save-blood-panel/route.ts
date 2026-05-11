import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { getAthleteId } from "@/lib/get-athlete-id";

export async function POST(req: NextRequest) {
  const athleteId = await getAthleteId();
  if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { url, filename } = await req.json();
  if (!url) return NextResponse.json({ error: "No URL" }, { status: 400 });

  const sb = createServerClient();

  const { data: existing } = await sb
    .from("athletes")
    .select("onboarding_data")
    .eq("id", athleteId)
    .single();

  const onboardingData = (existing?.onboarding_data as Record<string, unknown>) || {};

  await sb.from("athletes").update({
    onboarding_data: {
      ...onboardingData,
      blood_panel_url: url,
      blood_panel_filename: filename,
      blood_panel_uploaded_at: new Date().toISOString(),
    },
  }).eq("id", athleteId);

  return NextResponse.json({ ok: true });
}
