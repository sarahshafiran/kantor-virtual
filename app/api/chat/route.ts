import { NextResponse } from "next/server";
import { chatSessions, createChat } from "@/lib/multica";

export const dynamic = "force-dynamic";

/** Daftar obrolan dengan satu worker. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ws = u.searchParams.get("ws"); const agent = u.searchParams.get("agent");
  try {
    const all = await chatSessions(ws);
    const mine = all.filter(c => !agent || c.agent_id === agent).filter(c => c.status !== "archived")
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at));
    return NextResponse.json({ sessions: mine.map(c => ({ id: c.id, title: c.title || "Obrolan", updatedAt: c.updated_at, unread: c.unread_count ?? 0, last: c.last_message?.content?.slice(0, 120) ?? "" })) });
  } catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}

/** Mulai obrolan baru. */
export async function POST(req: Request) {
  const b = (await req.json()) as { ws?: string; agentId: string; title?: string; projectId?: string | null };
  try {
    const s = await createChat(b.ws ?? null, b.agentId, b.title?.trim() || "Obrolan baru", b.projectId);
    return NextResponse.json({ id: s.id });
  } catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}
