/**
 * GET /api/tickets
 *
 * Returns queendom-level ticket stats (6 metrics per queendom).
 * All computation is delegated to transformTickets() in lib/transformTickets.ts.
 *
 * Prefer /api/dashboard when you need both queendom and agent data — it runs
 * a single Supabase query instead of two.
 *
 * Response: { ananyshree: TicketStats, anishqa: TicketStats }
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
    console.error("[/api/tickets] Supabase error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { queendoms } = transformTickets(data as RawTicket[]);

  return NextResponse.json(queendoms, {
    headers: { "Cache-Control": "no-store" },
  });
}
