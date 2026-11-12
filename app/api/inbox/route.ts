import { NextResponse } from "next/server";
import { inbox, inboxUnread, markInboxRead, markAllInboxRead, loadDirectory } from "@/lib/multica";
import { cleanTitle } from "@/lib/titles";
import { plainText } from "@/lib/mentions";
import { DM_PREFIX } from "@/lib/dm";
import type { PxName } from "@/app/pixel-icon";

export const dynamic = "force-dynamic";

export type InboxView = { id: string; icon: PxName; label: string; title: string; excerpt: string; when: string; read: boolean; issueId: string | null; dmWith: string | null };

const KIND: Record<string, [PxName, string]> = {
  mentioned: ["mention", "mentioned you"],
  new_comment: ["chat", "posted a new message"],
  issue_assigned: ["pin", "assigned you a task"],
  status_changed: ["refresh", "changed the status"],
  task_failed: ["failed", "A run failed"],
  issue_subscribed: ["eyes", "You are now following this"],
  task_completed: ["party", "finished a run"],
};

/** Notifications for whoever is signed in on this laptop. */
export async function GET(req: Request) {
  const ws = new URL(req.url).searchParams.get("ws");
  const onlyCount = new URL(req.url).searchParams.get("count") === "1";
  try {
    if (onlyCount) return NextResponse.json({ unread: await inboxUnread(ws) });
    const tz = process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
    const [items, unread, dir] = await Promise.all([inbox(ws), inboxUnread(ws), loadDirectory(ws).catch(() => null)]);
    const actor = (t?: string | null, id?: string | null) => !id || !dir ? null : t === "agent"
      ? dir.agents.find(a => a.id === id)?.name ?? null
      : dir.members.find(m => m.user_id === id || m.id === id)?.name ?? null;
    const when = (iso: string) => {
      const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
      if (mins < 1) return "just now"; if (mins < 60) return `${mins}m ago`; if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
      return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(iso));
    };
    // Chat messages start with "@Your Name" (that is what triggers the notification); drop it from the preview.
    const dropLeadingMention = (t: string) => {
      const hit = dir?.members.map(m => "@" + m.name).sort((x, y) => y.length - x.length).find(n => t.startsWith(n));
      return hit ? t.slice(hit.length).trim() : t;
    };
    const view: InboxView[] = items.filter(i => !i.archived).slice(0, 50).map(i => {
      // A message in a person-to-person chat: show it as a message, and open the chat when clicked.
      const dm = (i.title ?? "").startsWith(DM_PREFIX);
      const [icon, verb]: [PxName, string] = dm ? ["chat", "sent you a message"] : KIND[i.type] ?? ["bell", "New update"];
      const who = actor(i.actor_type, i.actor_id);
      const startsWithVerb = /^[A-Z]/.test(verb);
      return { id: i.id, icon, label: startsWithVerb || !who ? verb.replace(/^\w/, c => c.toUpperCase()) : `${who} ${verb}`,
        title: dm ? "Direct message" : cleanTitle(i.title || "Task"), excerpt: (dm ? dropLeadingMention(plainText(i.body ?? "")) : plainText(i.body ?? "")).slice(0, 160), when: when(i.created_at), read: i.read, issueId: i.issue_id,
        dmWith: dm && i.actor_type !== "agent" ? i.actor_id ?? null : null };
    });
    return NextResponse.json({ unread, items: view });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const b = (await req.json()) as { ws?: string; id?: string; all?: boolean };
  try {
    if (b.all) await markAllInboxRead(b.ws ?? null);
    else if (b.id) await markInboxRead(b.ws ?? null, b.id);
    return NextResponse.json({ ok: true, unread: await inboxUnread(b.ws ?? null) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
