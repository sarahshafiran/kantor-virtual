import { NextResponse } from "next/server";
import { people } from "@/lib/dm";

export const dynamic = "force-dynamic";

/** Everyone you can message, with the latest message and unread count. With ?q=, also the newest message matching it. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ws = u.searchParams.get("ws");
  try {
    const r = await people(ws, u.searchParams.get("q"));
    return NextResponse.json({ people: r.people, unread: r.people.reduce((n, p) => n + p.unread, 0) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
