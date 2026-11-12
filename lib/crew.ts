// Data for the Board (tasks per project) and the Team page (people & agents, workload).
import type { Snapshot, Issue } from "./multica";
import { buildOffice, type Desk } from "./office";
import { friendlyTitle } from "./titles";
import type { Mentionable } from "./mentions";

import { type Col } from "./board-cols";
export { COLS, type Col } from "./board-cols";

export type Card = {
  id: string; title: string; key: string; col: Col; projectId: string | null; project: string | null; projectIcon: string | null;
  who: { kind: "agent" | "member"; id: string; name: string; emoji: string | null } | null;
  due: string | null; dueText: string | null; dueFlag: "late" | "risk" | null; priority: string; updated: string;
};
export type ProjectTab = { id: string; name: string; icon: string | null; open: number; done: number; total: number; due: string | null };
export type Board = { workspaceId: string; workspace: string; projects: ProjectTab[]; loose: number; cards: Card[]; people: Mentionable[] };

export type Load = { queued: number; doing: number; review: number; late: number; open: number; level: "santai" | "pas" | "sibuk" | "kewalahan" };
export type Mate = {
  kind: "human" | "agent"; id: string; name: string; emoji: string | null; avatar: string | null; sub: string; role: string | null;
  status: string; state: Desk["state"] | "here" | "away"; projects: { id: string; name: string; icon: string | null; open: number }[];
  load: Load; tasks: Card[]; runtimeOnline: boolean; runtimeId: string | null; isMe?: boolean;
};
export type Team = {
  workspaceId: string; workspace: string; humans: Mate[]; agents: Mate[];
  invites: { email: string; role: string; when: string }[];
  /** usable = you may move agents onto it (private engines belong to the laptop owner). */
  runtimes: { id: string; name: string; online: boolean; usable: boolean; owner: string | null }[];
};

const tz = () => process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(new Date());
const fmt = (d: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(d + "T00:00:00"));
const emojiOf = (u?: string | null) => (u?.startsWith("emoji:") ? u.slice(6) : null);
const imgOf = (u?: string | null) => (u && /^https?:/.test(u) ? u : null);
const colOf = (i: Issue): Col | null =>
  ["cancelled", "canceled", "duplicate"].includes(i.status) ? null :
  i.status === "done" || i.status === "completed" ? "done" :
  (["backlog", "todo", "in_progress", "in_review"] as const).find(c => c === i.status) ?? "todo";

export function levelOf(open: number): Load["level"] {
  return open === 0 ? "santai" : open <= 3 ? "pas" : open <= 6 ? "sibuk" : "kewalahan";
}

function cards(s: Snapshot): Card[] {
  const t = today();
  const pById = new Map(s.projects.map(p => [p.id, p]));
  const out: Card[] = [];
  for (const i of s.issues) {
    const col = colOf(i); if (!col) continue;
    if (col === "done" && Date.now() - Date.parse(i.updated_at) > 14 * 86400000) continue;
    let dueFlag: Card["dueFlag"] = null, dueText: string | null = null;
    if (i.due_date) {
      const d = Math.round((Date.parse(i.due_date) - Date.parse(t)) / 86400000);
      if (col === "done") dueText = fmt(i.due_date);
      else if (d < 0) { dueFlag = "late"; dueText = `${-d}d late`; }
      else if (d <= 2) { dueFlag = "risk"; dueText = d === 0 ? "Today" : d === 1 ? "Tomorrow" : fmt(i.due_date); }
      else dueText = fmt(i.due_date);
    }
    const agent = i.assignee_type === "agent" ? s.agents.find(a => a.id === i.assignee_id) : undefined;
    const member = i.assignee_type === "member" ? s.members.find(m => m.id === i.assignee_id || m.user_id === i.assignee_id) : undefined;
    const p = i.project_id ? pById.get(i.project_id) : undefined;
    out.push({
      id: i.id, title: friendlyTitle(i), key: i.identifier, col, projectId: p?.id ?? null, project: p?.title ?? null, projectIcon: p?.icon ?? null,
      who: agent ? { kind: "agent", id: agent.id, name: agent.name, emoji: emojiOf(agent.avatar_url) }
        : member ? { kind: "member", id: member.user_id, name: member.name, emoji: null } : null,
      due: i.due_date, dueText, dueFlag, priority: i.priority, updated: i.updated_at,
    });
  }
  const rank = (c: Card) => (c.dueFlag === "late" ? 0 : c.dueFlag === "risk" ? 1 : 2);
  return out.sort((a, b) => a.col === "done" && b.col === "done" ? b.updated.localeCompare(a.updated)
    : rank(a) - rank(b) || String(a.due ?? "9999").localeCompare(String(b.due ?? "9999")) || b.updated.localeCompare(a.updated));
}

const people = (s: Snapshot): Mentionable[] => [
  ...s.members.map(m => ({ kind: "member" as const, id: m.user_id, name: m.name, emoji: null })),
  ...s.agents.map(a => ({ kind: "agent" as const, id: a.id, name: a.name, emoji: emojiOf(a.avatar_url) })),
];

export function buildBoard(s: Snapshot): Board {
  const all = cards(s);
  const live = s.issues.filter(i => colOf(i));
  return {
    workspaceId: s.workspace.id, workspace: s.workspace.name, cards: all, people: people(s),
    loose: all.filter(c => !c.projectId && c.col !== "done").length,
    projects: s.projects.map(p => {
      const mine = live.filter(i => i.project_id === p.id);
      const done = mine.filter(i => colOf(i) === "done").length;
      return { id: p.id, name: p.title, icon: p.icon, total: mine.length, done, open: mine.length - done, due: p.due_date };
    }),
  };
}

function loadOf(cs: Card[]): Load {
  const open = cs.filter(c => c.col !== "done");
  return { queued: open.filter(c => c.col === "backlog" || c.col === "todo").length, doing: open.filter(c => c.col === "in_progress").length,
    review: open.filter(c => c.col === "in_review").length, late: open.filter(c => c.dueFlag === "late").length, open: open.length, level: levelOf(open.length) };
}

function projectsOf(cs: Card[]) {
  const m = new Map<string, { id: string; name: string; icon: string | null; open: number }>();
  for (const c of cs) if (c.projectId) {
    const cur = m.get(c.projectId) ?? { id: c.projectId, name: c.project ?? "", icon: c.projectIcon, open: 0 };
    if (c.col !== "done") cur.open++;
    m.set(c.projectId, cur);
  }
  return [...m.values()].sort((a, b) => b.open - a.open);
}

export function buildTeam(s: Snapshot, invites: { invitee_email: string; role: string; created_at: string; status?: string }[], meId: string | null): Team {
  const all = cards(s);
  const office = buildOffice(s);
  const desks = new Map<string, Desk>();
  for (const d of [...office.rooms.flatMap(r => r.desks), ...office.idleDesks]) if (!desks.has(d.agentId)) desks.set(d.agentId, d);
  const rtOnline = new Map(s.runtimes.map(r => [r.id, r.status === "online"]));
  const seen = s.seen ?? {};
  const rel = (iso?: string) => {
    if (!iso) return { here: false, text: "hasn't opened the office yet" };
    const mins = (Date.now() - Date.parse(iso)) / 60000;
    return { here: mins < 5, text: mins < 5 ? "in the office now" : mins < 60 ? `last seen ${Math.round(mins)}m ago` : mins < 1440 ? `last seen ${Math.round(mins / 60)}h ago` : `last seen ${Math.round(mins / 1440)}d ago` };
  };
  const ROLE: Record<string, string> = { owner: "Owner", admin: "Admin", member: "Member" };

  const humans: Mate[] = s.members.map((m): Mate => {
    const tasks = all.filter(c => c.who?.kind === "member" && c.who.id === m.user_id);
    const p = rel(seen[m.name]);
    return { kind: "human", id: m.user_id, name: m.name, emoji: null, avatar: null, sub: m.email, role: ROLE[m.role] ?? m.role,
      status: p.text, state: p.here ? "here" : "away", projects: projectsOf(tasks), load: loadOf(tasks), tasks, runtimeOnline: true, runtimeId: null, isMe: m.user_id === meId };
  }).sort((a, b) => Number(!!b.isMe) - Number(!!a.isMe) || a.name.localeCompare(b.name));

  const agents: Mate[] = s.agents.map((a): Mate => {
    const tasks = all.filter(c => c.who?.kind === "agent" && c.who.id === a.id);
    const d = desks.get(a.id);
    return { kind: "agent", id: a.id, name: a.name, emoji: emojiOf(a.avatar_url), avatar: imgOf(a.avatar_url), sub: a.description || "", role: null,
      status: d?.bubble ?? "", state: d?.state ?? "home", projects: projectsOf(tasks), load: loadOf(tasks), tasks, runtimeOnline: !!rtOnline.get(a.runtime_id), runtimeId: a.runtime_id };
  }).sort((a, b) => b.load.open - a.load.open || a.name.localeCompare(b.name));

  return {
    workspaceId: s.workspace.id, workspace: s.workspace.name, humans, agents,
    invites: invites.filter(i => !i.status || i.status === "pending")
      .filter(i => !s.members.some(m => m.email.toLowerCase() === i.invitee_email.toLowerCase()))
      .map(i => ({ email: i.invitee_email, role: ROLE[i.role] ?? i.role, when: fmt(i.created_at.slice(0, 10)) })),
    runtimes: s.runtimes.map(r => {
      const base = r.provider === "claude" ? "Claude" : r.provider === "codex" ? "GPT (Codex)" : r.name.replace(/\s*\(.*\)\s*$/, "");
      const owner = s.members.find(m => m.user_id === r.owner_id || m.id === r.owner_id)?.name.split(/\s+/)[0];
      const shared = s.runtimes.filter(x => x.provider === r.provider).length > 1;
      const sharedWith = (r.shared_with ?? []).map(x => typeof x === "string" ? x : (x as { user_id?: string; id?: string })?.user_id ?? (x as { id?: string })?.id);
      const usable = r.visibility !== "private" || !meId || r.owner_id === meId || sharedWith.includes(meId);
      return { id: r.id, name: shared && owner ? `${base} · ${owner}` : base, online: r.status === "online", usable, owner: owner ?? null };
    }),
  };
}
