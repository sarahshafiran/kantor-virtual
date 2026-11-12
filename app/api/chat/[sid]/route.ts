import { NextResponse } from "next/server";
import { chatMessages, chatPending, sendChat, markChatRead, workspace } from "@/lib/multica";

export const dynamic = "force-dynamic";

const tz = () => process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz(), weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

async function view(ws: string | null, sid: string) {
  const w = await workspace(ws);
  const [msgs, pending] = await Promise.all([chatMessages(ws, sid), chatPending(ws, sid)]);
  markChatRead(ws, sid);
  return {
    messages: msgs.sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)).map(m => ({
      id: m.id, mine: m.role === "user", text: m.content, when: when(m.created_at),
      failed: m.failure_reason ? "The agent couldn't answer this message. Try sending it again." : null,
      files: (m.attachments ?? []).map(a => ({ id: a.id, name: a.filename, url: `/api/file/${a.id}?ws=${w.id}` })),
    })),
    working: !!pending.task_id,
  };
}

export async function GET(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const ws = new URL(req.url).searchParams.get("ws");
  try { return NextResponse.json(await view(ws, sid)); }
  catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}

export async function POST(req: Request, ctx: { params: Promise<{ sid: string }> }) {
  const { sid } = await ctx.params;
  const b = (await req.json()) as { ws?: string; text?: string; files?: string[] };
  if (!b.text?.trim() && !b.files?.length) return NextResponse.json({ error: "The message is empty." }, { status: 400 });
  try {
    await sendChat(b.ws ?? null, sid, b.text?.trim() ?? "", b.files ?? []);
    return NextResponse.json(await view(b.ws ?? null, sid));
  } catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}
