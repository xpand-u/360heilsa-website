import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

const ATHLETE_ID = process.env.RAFN_ATHLETE_ID!;

export async function GET() {
  const sb = createServerClient();

  const { data } = await sb
    .from("terra_connections")
    .select("id,terra_user_id,provider,connected_at,last_sync,is_active")
    .eq("athlete_id", ATHLETE_ID)
    .eq("is_active", true)
    .order("connected_at", { ascending: false });

  return NextResponse.json({ connections: data || [] });
}

export async function DELETE(req: Request) {
  const { terra_user_id } = await req.json();
  if (!terra_user_id) return NextResponse.json({ error: "terra_user_id required" }, { status: 400 });

  const sb = createServerClient();
  await sb
    .from("terra_connections")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("athlete_id", ATHLETE_ID)
    .eq("terra_user_id", terra_user_id);

  return NextResponse.json({ ok: true });
}
