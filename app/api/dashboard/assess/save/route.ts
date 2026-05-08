/**
 * POST /api/dashboard/assess/save
 * Saves a completed screening report + photos to the assessments table.
 * Photos are uploaded to Supabase Storage; URLs stored in assessments.photos JSONB.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;
const BUCKET = "assessment-photos";

export async function POST(req: NextRequest) {
  const { report_md, dominant_pattern, shoulder_finding, assessment_date, photos } =
    await req.json();

  if (!report_md) {
    return NextResponse.json({ error: "report_md required" }, { status: 400 });
  }

  const sb = createServerClient();
  const date = assessment_date || new Date().toISOString().slice(0, 10);

  // Upload photos to Supabase Storage
  const photoUrls: Record<string, string> = {};
  if (photos && typeof photos === "object") {
    for (const [slot, base64] of Object.entries(photos as Record<string, string>)) {
      if (!base64) continue;
      try {
        const buffer = Buffer.from(base64, "base64");
        const path = `${ATHLETE_ID}/${date}/${slot}.jpg`;
        const { error } = await sb.storage.from(BUCKET).upload(path, buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });
        if (!error) {
          const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
          photoUrls[slot] = data.publicUrl;
        }
      } catch {
        // Non-fatal — save report even if a photo upload fails
      }
    }
  }

  const { data, error } = await sb
    .from("assessments")
    .insert({
      athlete_id:       ATHLETE_ID,
      assessment_date:  date,
      dominant_pattern: dominant_pattern || null,
      shoulder_finding: shoulder_finding || null,
      full_notes_md:    report_md,
      photos:           Object.keys(photoUrls).length > 0 ? photoUrls : null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, photoUrls });
}
