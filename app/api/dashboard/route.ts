/**
 * GET /api/dashboard
 *
 * Unified endpoint. Fetches every ticket row ONCE, passes the array through
 * transformTickets(), and returns a single clean JSON object that contains
 * all the metrics the UI needs — queendom stats AND per-agent stats.
 *
 * Dashboard.tsx calls this instead of /api/tickets + /api/agents separately,
 * cutting Supabase round-trips in half.
 *
 * Response shape:
 * {
 *   queendoms: {
 *     ananyshree: TicketStats,
 *     anishqa:    TicketStats
 *   },
 *   agents: {
 *     "<agent name>": {
 *       tasksAssignedToday, tasksCompletedToday,
 *       tasksCompletedThisMonth, overdueCount
 *     },
 *     ...
 *   }
 * }
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { transformTickets, type RawTicket } from "@/lib/transformTickets";

export async function GET() {
  const url        = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  if (!url || !serviceKey || serviceKey === "paste_your_service_role_key_here") {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 503 },
    );
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await db
    .from("tickets")
    .select("status, queendom_name, agent_name, created_at, resolved_at");

  if (error) {
    console.error("[/api/dashboard] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const stats = transformTickets(data as RawTicket[]);

  return NextResponse.json(stats, {
    headers: { "Cache-Control": "no-store" },
  });
}
