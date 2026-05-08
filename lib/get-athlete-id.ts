import { cookies } from "next/headers";
import { createSessionClient } from "./supabase-ssr";
import { createServerClient } from "./supabase-server";

/**
 * Returns the athlete_id for the currently authenticated user.
 * Returns null if the request is unauthenticated or has no athlete record.
 *
 * Usage in API routes:
 *   const athleteId = await getAthleteId();
 *   if (!athleteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */
export async function getAthleteId(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionClient = createSessionClient(cookieStore);

  const { data: { user }, error: authError } = await sessionClient.auth.getUser();
  if (authError || !user) return null;

  // Look up athlete record by Supabase auth user_id
  const adminClient = createServerClient(); // service role — bypasses RLS
  const { data, error: athleteError } = await adminClient
    .from("athletes")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (athleteError && athleteError.code !== "PGRST116") {
    // PGRST116 = "no rows" — expected for new users; anything else is a real error
    console.error("[getAthleteId] athlete lookup failed:", athleteError.message);
  }

  return data?.id ?? null;
}

/**
 * Returns the full Supabase auth user for the current session.
 * Returns null if unauthenticated.
 */
export async function getAuthUser() {
  const cookieStore = await cookies();
  const sessionClient = createSessionClient(cookieStore);
  const { data: { user }, error } = await sessionClient.auth.getUser();
  if (error) return null;
  return user ?? null;
}
