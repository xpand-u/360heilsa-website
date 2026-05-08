/**
 * GET /api/exercise/tutorial?name=X
 * Fetches exercise GIF + instructions from ExerciseDB (RapidAPI).
 * Falls back to YouTube search URL if API key not set or exercise not found.
 * Caches in-process for 24h.
 */

import { NextRequest, NextResponse } from "next/server";

const RAPID_API_KEY = process.env.RAPIDAPI_KEY;
const CACHE_TTL     = 24 * 60 * 60 * 1000; // 24 hours

const cache: Record<string, { data: any; ts: number }> = {};

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name")?.trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const cacheKey = name.toLowerCase();

  if (cache[cacheKey] && Date.now() - cache[cacheKey].ts < CACHE_TTL) {
    return NextResponse.json({ ...cache[cacheKey].data, from_cache: true });
  }

  const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(name + " exercise tutorial how to")}`;

  if (!RAPID_API_KEY) {
    return NextResponse.json({ youtube_url: youtubeUrl });
  }

  try {
    // ExerciseDB expects lowercase, no special chars, spaces as %20
    const apiName = name
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, "")
      .trim()
      .replace(/\s+/g, "%20");

    const res = await fetch(
      `https://exercisedb.p.rapidapi.com/exercises/name/${apiName}?limit=1&offset=0`,
      {
        headers: {
          "x-rapidapi-key": RAPID_API_KEY,
          "x-rapidapi-host": "exercisedb.p.rapidapi.com",
        },
        // 6 second timeout
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!res.ok) throw new Error(`ExerciseDB ${res.status}`);

    const exercises = await res.json();
    const ex = Array.isArray(exercises) ? exercises[0] : null;

    if (!ex) {
      return NextResponse.json({ youtube_url: youtubeUrl });
    }

    const data = {
      name:              ex.name,
      gif_url:           ex.gifUrl,
      target:            ex.target,
      body_part:         ex.bodyPart,
      equipment:         ex.equipment,
      secondary_muscles: ex.secondaryMuscles || [],
      instructions:      ex.instructions || [],
      youtube_url:       youtubeUrl,
    };

    cache[cacheKey] = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch {
    // Don't cache failures
    return NextResponse.json({ youtube_url: youtubeUrl });
  }
}
