import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const checks: Record<string, string> = {};

  try {
    await prisma.unit.count();
    checks.prisma = "ok";
  } catch {
    return NextResponse.json({ status: "error", message: "DB unreachable", checks }, { status: 503 });
  }

  // Supabase tracks activity via PostgREST requests, not direct Postgres connections.
  // This REST ping is what actually resets the auto-pause timer.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    checks.supabase_rest = "skipped — env vars missing";
  } else {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/Unit?select=id&limit=1`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      });
      checks.supabase_rest = res.ok ? "ok" : `failed (${res.status})`;
    } catch (e) {
      checks.supabase_rest = `error — ${e instanceof Error ? e.message : "unknown"}`;
    }
  }

  return NextResponse.json({ status: "ok", checks }, { status: 200 });
}
