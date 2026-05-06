/**
 * Generates a Terra widget session URL.
 * The client is redirected to this URL to connect their wearable via OAuth.
 *
 * POST /api/terra/connect
 * Body: { athlete_id: string }
 * Returns: { url: string }
 */

import { NextRequest, NextResponse } from "next/server";

const TERRA_API_URL = "https://api.tryterra.co/v2/auth/generateWidgetSession";

const SUPPORTED_PROVIDERS = [
  "GARMIN",
  "OURA",
  "WHOOP",
  "POLAR",
  "SUUNTO",
  "WITHINGS",
  "FITBIT",
  "APPLE",
  "GOOGLE",
  "SAMSUNG",
  "ULTRAHUMAN",
].join(",");

export async function POST(req: NextRequest) {
  const body = await req.json();
  // Use provided athlete_id or fall back to env var (single-user phase)
  const athlete_id = body.athlete_id || process.env.RAFN_ATHLETE_ID;

  if (!athlete_id) {
    return NextResponse.json({ error: "athlete_id required" }, { status: 400 });
  }

  const devId  = process.env.TERRA_DEV_ID;
  const apiKey = process.env.TERRA_API_KEY;

  if (!devId || !apiKey) {
    return NextResponse.json(
      { error: "Terra not configured. Add TERRA_DEV_ID and TERRA_API_KEY to env vars." },
      { status: 503 }
    );
  }

  const res = await fetch(TERRA_API_URL, {
    method: "POST",
    headers: {
      "dev-id":       devId,
      "x-api-key":    apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      providers:    SUPPORTED_PROVIDERS,
      language:     "en",
      reference_id: athlete_id,           // passed back in webhook → maps to athlete
      auth_success_redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://360heilsa.is"}/dashboard/connect?success=true`,
      auth_failure_redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL || "https://360heilsa.is"}/dashboard/connect?error=true`,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Terra generateWidgetSession error:", err);
    return NextResponse.json({ error: "Failed to create Terra session" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json({ url: data.url, session_id: data.session_id });
}
