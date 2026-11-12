// Person-to-person chat. Multica only has chat with agents, so each conversation is a hidden issue:
// unassigned, kept in backlog (no agent ever runs on it), tagged with metadata "kantor_dm".
// Every message @mentions the other person so Multica drops it in their notifications.
import "server-only";
import { workspace, allIssues, loadDirectory, me, call_, createIssue, setIssueMeta, addComment, type Comment } from "./multica";
import { telegram } from "./telegram";
import { plainText } from "./mentions";

export const DM_KEY = "kantor_dm";
export const DM_PREFIX = "💬 Chat";
// Multica metadata values must be plain text, so the pair is stored as "userA,userB" (sorted).

export type DmMessage = { id: string; mine: boolean; who: string; text: string; when: string; at: string };
export type DmPerson = { userId: string; name: string; email: string; dmId: string | null; last: { text: string; when: string; mine: boolean } | null; unread: number };

const tz = () => process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
const when = (iso: string) => {
  const mins = (Date.now() - Date.parse(iso)) / 60000;
  if (mins < 1) return "just now";
  if (mins < 60) return `${Math.round(mins)}m ago`;
  if (mins < 1440) return new Intl.DateTimeFormat("en-GB", { timeZone: tz(), hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz(), day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
};
const pairOf = (a: string, b: string) => [a, b].sort();
const same = (m: unknown, pair: string[]) => typeof m === "string" && m.split(",").sort().join() === pair.join();
// The mention we add at the start of every message is for notifications only; hide it when showing the chat.
const strip = (t: string) => t.replace(/^\s*\[@[^\]]+\]\(mention:\/\/member\/[0-9a-fA-F-]+\)\s*/, "");

const isChat = (i: { title: string; metadata?: Record<string, unknown> }) => !!(i.metadata ?? {})[DM_KEY] || i.title.startsWith(DM_PREFIX);
async function chats(wsId: string) {
  return (await allIssues(wsId)).filter(isChat);
}
async function comments(wsId: string, issueId: string) {
  const d = await call_<unknown>("GET", `/api/issues/${issueId}/comments`, wsId);
  const list = (Array.isArray(d) ? d : (d as { comments?: Comment[] })?.comments ?? []) as Comment[];
  return list.filter(c => !c.deleted_at).sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
/** Unread chat notifications per chat issue (from the Multica inbox of whoever is signed in). */
async function unreadByIssue(wsId: string) {
  const d = await call_<unknown>("GET", "/api/inbox", wsId).catch(() => []);
  const items = (Array.isArray(d) ? d : (d as { items?: unknown[] })?.items ?? []) as { issue_id: string | null; read: boolean; archived?: boolean }[];
  const out = new Map<string, number>();
  for (const i of items) if (i.issue_id && !i.read && !i.archived) out.set(i.issue_id, (out.get(i.issue_id) ?? 0) + 1);
  return out;
}

/** Everyone else in the workspace, with the latest message and unread count of your chat with them. */
export async function people(wsPick?: string | null) {
  const ws = await workspace(wsPick);
  const [dir, mine, list, unread] = await Promise.all([loadDirectory(ws.id), me(), chats(ws.id), unreadByIssue(ws.id)]);
  const out: DmPerson[] = [];
  for (const m of dir.members.filter(m => m.user_id !== mine.id)) {
    const pair = pairOf(mine.id, m.user_id);
    const issue = list.find(i => same((i.metadata ?? {})[DM_KEY], pair))
      ?? list.find(i => !(i.metadata ?? {})[DM_KEY] && (i.title === `${DM_PREFIX} · ${mine.name} & ${m.name}` || i.title === `${DM_PREFIX} · ${m.name} & ${mine.name}`));
    let last: DmPerson["last"] = null;
    if (issue) {
      const cs = await comments(ws.id, issue.id);
      const c = cs[cs.length - 1];
      if (c) last = { text: plainText(strip(c.content)).slice(0, 90), when: when(c.created_at), mine: c.author_id === mine.id };
    }
    out.push({ userId: m.user_id, name: m.name, email: m.email, dmId: issue?.id ?? null, last, unread: issue ? unread.get(issue.id) ?? 0 : 0 });
  }
  return { me: mine, people: out.sort((a, b) => b.unread - a.unread || Number(!!b.last) - Number(!!a.last) || a.name.localeCompare(b.name)) };
}

async function find(wsId: string, myId: string, otherId: string, names?: [string, string]) {
  const pair = pairOf(myId, otherId);
  const list = await chats(wsId);
  const hit = list.find(i => same((i.metadata ?? {})[DM_KEY], pair));
  if (hit || !names) return hit ?? null;
  // A chat whose tag never got saved: recognise it by its title and tag it now.
  const titles = [`${DM_PREFIX} · ${names[0]} & ${names[1]}`, `${DM_PREFIX} · ${names[1]} & ${names[0]}`];
  const orphan = list.find(i => !(i.metadata ?? {})[DM_KEY] && titles.includes(i.title));
  if (orphan) await setIssueMeta(wsId, orphan.id, DM_KEY, pair.join(","));
  return orphan ?? null;
}

/** The conversation with one person (marks its notifications as read). */
export async function thread(wsPick: string | null | undefined, otherId: string) {
  const ws = await workspace(wsPick);
  const [mine, dir] = await Promise.all([me(), loadDirectory(ws.id)]);
  const other = dir.members.find(m => m.user_id === otherId);
  if (!other) throw new Error("That person isn't in this workspace.");
  const issue = await find(ws.id, mine.id, otherId, [mine.name, other.name]);
  if (!issue) return { dmId: null, other: { userId: other.user_id, name: other.name }, messages: [] as DmMessage[] };
  const cs = await comments(ws.id, issue.id);
  await call_("POST", `/api/inbox/issues/${issue.id}/read`, ws.id, {}).catch(() => null);
  const nameOf = (id: string) => dir.members.find(m => m.user_id === id || m.id === id)?.name ?? "Someone";
  return {
    dmId: issue.id, other: { userId: other.user_id, name: other.name },
    messages: cs.map(c => ({ id: c.id, mine: c.author_id === mine.id, who: c.author_id === mine.id ? "You" : nameOf(c.author_id), text: strip(c.content), when: when(c.created_at), at: c.created_at })),
  };
}

/** Send a message, creating the hidden chat issue the first time. */
export async function send(wsPick: string | null | undefined, otherId: string, text: string) {
  const ws = await workspace(wsPick);
  const [mine, dir] = await Promise.all([me(), loadDirectory(ws.id)]);
  const other = dir.members.find(m => m.user_id === otherId);
  if (!other) throw new Error("That person isn't in this workspace.");
  let issue = await find(ws.id, mine.id, otherId, [mine.name, other.name]);
  if (!issue) {
    const created = await createIssue(ws.id, {
      title: `${DM_PREFIX} · ${mine.name} & ${other.name}`,
      description: `Private chat between ${mine.name} and ${other.name} in Virtual Office. Please leave it unassigned and in backlog.`,
      status: "backlog", priority: "none",
    });
    await setIssueMeta(ws.id, created.id, DM_KEY, pairOf(mine.id, otherId).join(","));
    issue = { id: created.id } as typeof issue & { id: string };
  }
  await addComment(ws.id, issue!.id, `[@${other.name}](mention://member/${other.user_id}) ${text}`);
  const tg = { id: ws.id, slug: ws.slug, name: ws.name, members: dir.members.map(m => m.name) };
  void telegram(`💬 **${mine.name}**: ${plainText(text).slice(0, 300)}\n\nReply in Virtual Office → Messages.`, other.name, tg).catch(() => 0);
  return thread(ws.id, otherId);
}
