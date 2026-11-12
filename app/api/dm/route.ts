import { NextResponse } from "next/server";
import { people } from "@/lib/dm";

export const dynamic = "force-dynamic";

/** Everyone you can message, with the latest message and unread count. */
export async function GET(req: Request) {
  const ws = new URL(req.url).searchParams.get("ws");
  try {
    const r = await people(ws);
    return NextResponse.json({ people: r.people, unread: r.people.reduce((n, p) => n + p.unread, 0) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
