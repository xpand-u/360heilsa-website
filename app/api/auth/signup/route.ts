import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSessionClient } from "@/lib/supabase-ssr";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "Name, email and password required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const sessionClient = createSessionClient(cookieStore);

  // Create Supabase auth user (trigger auto-creates users row)
  const { data: authData, error: signUpError } = await sessionClient.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: { full_name: name.trim() },
    },
  });

  if (signUpError || !authData.user) {
    return NextResponse.json(
      { error: signUpError?.message ?? "Signup failed" },
      { status: 400 }
    );
  }

  const authUserId = authData.user.id;
  const coachId = process.env.COACH_USER_ID;

  if (!coachId) {
    return NextResponse.json({ error: "Coach not configured — contact Rafn" }, { status: 500 });
  }

  // Create athlete record linked to this auth user
  const adminClient = createServerClient();
  const { data: athlete, error: athleteError } = await adminClient
    .from("athletes")
    .insert({
      user_id: authUserId,
      coach_id: coachId,
      full_name: name.trim(),
      status: "active",
      calendar_token: crypto.randomUUID().replace(/-/g, ""),
    })
    .select("id")
    .single();

  if (athleteError || !athlete) {
    // Roll back auth user if athlete creation fails
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(authUserId);
    if (deleteError) {
      console.error("[signup] Failed to roll back auth user after athlete insert failure:", deleteError.message);
    }
    return NextResponse.json({ error: "Failed to create athlete profile" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, athleteId: athlete.id });
}
