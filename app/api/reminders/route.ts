import { NextResponse } from "next/server";
import { loadDirectory, me } from "@/lib/multica";
import { listReminders, addReminder, cancelReminder, zonedTime, fmtWhen, type ReminderView } from "@/lib/reminders";
import { telegramReady } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const fail = (e: unknown, status = 500) => NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status });

/** Upcoming Telegram reminders in this office. */
export async function GET(req: Request) {
  const ws = new URL(req.url).searchParams.get("ws");
  try {
    const dir = await loadDirectory(ws);
    const w = dir.workspace;
    return NextResponse.json({
      items: await listReminders(w.id, dir.members),
      telegram: telegramReady({ id: w.id, slug: w.slug, name: w.name, members: dir.members.map(m => m.name) }),
    });
  } catch (e) { return fail(e); }
}

/** New reminder for whoever is signed in: { ws, text, date: "YYYY-MM-DD", time: "HH:MM", notes? } */
export async function POST(req: Request) {
  const b = (await req.json()) as { ws?: string; text?: string; date?: string; time?: string; notes?: string };
  const text = (b.text ?? "").trim();
  const at = zonedTime(b.date ?? "", b.time ?? "");
  if (!text) return fail("Write what to be reminded about.", 400);
  if (!at) return fail("Pick a date and time.", 400);
  if (at.getTime() < Date.now() - 60000) return fail("That time has already passed.", 400);
  try {
    const user = await me();
    const id = await addReminder(b.ws ?? null, text.slice(0, 200), at, user.id, b.notes ?? "");
    const item: ReminderView = { id, text: text.slice(0, 200), at: at.toISOString(), atText: fmtWhen(at), who: user.name, late: false };
    return NextResponse.json({ ok: true, item });
  } catch (e) { return fail(e); }
}

/** Cancel a reminder: { ws, id } */
export async function DELETE(req: Request) {
  const b = (await req.json()) as { ws?: string; id?: string };
  if (!b.id) return fail("Missing reminder.", 400);
  try { await cancelReminder(b.ws ?? null, b.id); return NextResponse.json({ ok: true }); }
  catch (e) { return fail(e); }
}
