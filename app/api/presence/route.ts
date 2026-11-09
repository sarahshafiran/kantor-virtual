import { NextResponse } from "next/server";
import { heartbeat, me } from "@/lib/multica";

export const dynamic = "force-dynamic";

/** Detak "sedang online" dari app yang sedang terbuka. */
export async function POST(req: Request) {
  try {
    const { ws } = (await req.json()) as { ws?: string };
    await heartbeat(ws ?? null, (await me()).name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
