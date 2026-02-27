import { type NextRequest, NextResponse } from "next/server";

import { createCaller } from "~/server/api/root";
import { createTRPCContext } from "~/server/api/trpc";

/**
 * GET /api/cron/scan-inbox
 *
 * Called by Vercel Cron on the schedule defined in vercel.json.
 * Protected by the CRON_SECRET environment variable — Vercel automatically
 * adds an Authorization: Bearer <CRON_SECRET> header to cron requests.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const ctx = await createTRPCContext({ headers: req.headers });
    const caller = createCaller(ctx);
    const result = await caller.email.scanInbox();

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/scan-inbox] Error:", err);
    return NextResponse.json(
      { ok: false, error: String(err) },
      { status: 500 }
    );
  }
}
