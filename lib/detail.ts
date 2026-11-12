// One task in plain words: who has it, what is happening, and what you need to do.
import "server-only";
import { issueDetail, loadDirectory, activeRuns, kantorSettings } from "./multica";
import { friendlyTitle } from "./titles";
import type { Mentionable } from "./mentions";
import { digest, type Digest } from "./digest";

export type Message = {
  id: string; who: string; whoKind: "agent" | "member" | "system"; emoji: string | null; when: string; text: string;
  images: { id: string; name: string; url: string }[]; files: { id: string; name: string; url: string }[];
};
export type TaskDetail = {
  id: string; title: string; originalTitle: string; key: string; project: string | null; url: string;
  status: string; situation: string; mode: "review" | "human" | "working" | "waiting" | "closed";
  due: string | null; dueText: string | null; dueFlag: "late" | "risk" | "done" | null;
  assignee: { kind: "agent" | "member" | null; id: string | null; name: string | null; emoji: string | null; online: boolean };
  brief: string; messages: Message[]; me: string;
  /** Who can be called with @ on this task. */
  people: Mentionable[];
  /** Every file on this task (outputs + attachments), newest first. */
  artifacts: { id: string; name: string; url: string; image: boolean; from: string; when: string; inChat: boolean }[];
  live: { state: "running" | "queued" | "waiting" | "idle"; label: string };
  /** Short summary + questions from the latest agent message, for the "Your part" side. */
  digest: (Digest & { from: string; when: string; messageId: string; open: boolean }) | null;
};

const isImage = (f: { filename: string; content_type?: string }) =>
  (f.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.filename);

export async function buildDetail(id: string, wsPick?: string | null): Promise<TaskDetail> {
  const tz = process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
  const [{ issue, comments, attachments, me }, snap, runs, kantor] = await Promise.all([issueDetail(id, wsPick), loadDirectory(wsPick), activeRuns(wsPick, id), kantorSettings(wsPick).catch(() => ({ open: true }))]);
  const agent = issue.assignee_type === "agent" ? snap.agents.find(a => a.id === issue.assignee_id) : undefined;
  const member = issue.assignee_type === "member" ? snap.members.find(m => m.id === issue.assignee_id || m.user_id === issue.assignee_id) : undefined;
  const runtime = agent ? snap.runtimes.find(r => r.id === agent.runtime_id) : undefined;
  const emoji = (u?: string | null) => (u?.startsWith("emoji:") ? u.slice(6) : null);
  const nameOf = (kind: string, aid: string) => kind === "agent"
    ? snap.agents.find(a => a.id === aid)?.name ?? "Agent"
    : snap.members.find(m => m.id === aid || m.user_id === aid)?.name ?? "Member";
  const emojiOf = (kind: string, aid: string) => (kind === "agent" ? emoji(snap.agents.find(a => a.id === aid)?.avatar_url) : null);
  const when = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const proxied = (f: { id: string; filename: string }) => ({ id: f.id, name: f.filename, url: `/api/file/${f.id}?ws=${snap.workspace.id}` });
  const files = (list: { id: string; filename: string; url: string; download_url?: string; content_type?: string }[]) => ({
    images: list.filter(isImage).map(proxied),
    files: list.filter(f => !isImage(f)).map(proxied),
  });

  const messages: Message[] = comments
    .filter(c => !c.deleted_at)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map(c => ({
      id: c.id, who: nameOf(c.author_type, c.author_id), whoKind: c.author_type === "agent" ? "agent" : c.author_type === "member" ? "member" : "system",
      emoji: emojiOf(c.author_type, c.author_id), when: when(c.created_at), text: c.content, ...files(c.attachments ?? []),
    }));
  // Rak "Hasil kerja": semua file, baik yang dikirim di pesan maupun yang ditempel langsung ke task.
  type Art = TaskDetail["artifacts"][number] & { t: number };
  const arts = new Map<string, Art>();
  for (const c of comments.filter(c => !c.deleted_at)) for (const a of c.attachments ?? [])
    arts.set(a.id, { ...proxied(a), image: isImage(a), from: nameOf(c.author_type, c.author_id), when: when(c.created_at), inChat: true, t: Date.parse(c.created_at) });
  for (const a of attachments) if (!arts.has(a.id)) {
    const at = a.created_at ?? issue.updated_at;
    arts.set(a.id, { ...proxied(a), image: isImage(a), from: a.uploader_type && a.uploader_id ? nameOf(a.uploader_type, a.uploader_id) : "Task attachment", when: when(at), inChat: false, t: Date.parse(at) });
  }
  const artifacts = [...arts.values()].sort((a, b) => b.t - a.t).map(({ t: _t, ...rest }) => rest);

  // Worker sudah menyelesaikan bagiannya (pesan terakhir dari worker, tidak ada run berjalan),
  // tapi status task belum dipindah ke review. Kamu bisa langsung menyetujui atau minta revisi.
  const lastMsg = messages[messages.length - 1];
  const finished = issue.assignee_type === "agent" && (issue.status === "in_review" ||
    (["todo", "in_progress"].includes(issue.status) && runs.length === 0 && lastMsg?.whoKind === "agent"));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  let dueFlag: TaskDetail["dueFlag"] = null, dueText: string | null = null;
  if (issue.due_date) {
    const d = Math.round((Date.parse(issue.due_date) - Date.parse(today)) / 86400000);
    const nice = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(new Date(issue.due_date + "T00:00:00"));
    if (d < 0 && finished) { dueFlag = "done"; dueText = `Done, ${-d} day${-d === 1 ? "" : "s"} late (due ${nice})`; }
    else if (d < 0) { dueFlag = "late"; dueText = `${-d} day${-d === 1 ? "" : "s"} late (due ${nice})`; }
    else if (d <= 2 && finished) dueText = `Due ${nice} · already done`;
    else if (d <= 2) { dueFlag = "risk"; dueText = d === 0 ? "Due today" : d === 1 ? "Due tomorrow" : `Due ${nice}`; }
    else dueText = `Due ${nice}`;
  }

  const closed = ["done", "cancelled", "canceled"].includes(issue.status);
  const lastIsAgentQuestion = messages.length > 0 && messages[messages.length - 1].whoKind === "agent" && /\?\s*$/.test(messages[messages.length - 1].text.trim());
  let mode: TaskDetail["mode"]; let situation: string;
  const aName = agent?.name ?? member?.name ?? "nobody yet";
  if (closed) { mode = "closed"; situation = "All done."; }
  else if (issue.assignee_type === "member") { mode = "human"; situation = `A to-do for ${member?.name ?? "a person"}. Agents wait until it is marked done.`; }
  else if (issue.status === "in_review") { mode = "review"; situation = `${aName} is done and waiting for your review.`; }
  else if (lastIsAgentQuestion) { mode = "waiting"; situation = `${aName} is waiting for your answer.`; }
  else if (finished) { mode = "review"; situation = `${aName} finished their part. If it looks good, press ✅ Approve to close this task.`; }
  else if (issue.status === "in_progress") { mode = "working"; situation = runtime?.status === "online" ? `${aName} is working on this.` : `${aName} will continue once the office is open (laptop on).`; }
  else if (issue.status === "todo") { mode = "working"; situation = `In ${aName}'s queue, ready to start.`; }
  else { mode = "working"; situation = `In ${aName}'s backlog, not started yet.`; }

  // Apa yang sedang terjadi sekarang pada task ini (untuk tanda proses di layar).
  const running = runs.find(r => ["running", "dispatched", "started", "preparing", "in_progress"].includes(r.status));
  const queued = runs.find(r => r.status === "queued");
  const aN = agent?.name ?? "The agent";
  let live: TaskDetail["live"];
  if (running) live = { state: "running", label: `${aN} is working…` };
  else if (queued && kantor.open === false) live = { state: "waiting", label: "🔒 Office closed. Work starts when it opens." };
  else if (queued && runtime?.status !== "online") live = { state: "waiting", label: "🌙 Laptop off. Work starts when it is back on." };
  else if (queued) live = { state: "queued", label: `${aN} will start soon (queued)…` };
  else if (issue.status === "backlog" && (issue.metadata ?? {}).kantor_parked) live = { state: "waiting", label: "🔒 Waiting for the office to open." };
  else live = { state: "idle", label: "" };

  // Summary and questions come from the agent's latest message; questions are only open when nobody has replied since.
  const lastAgent = [...messages].reverse().find(m => m.whoKind === "agent" && m.text.trim());
  const dg = lastAgent ? digest(lastAgent.text) : null;
  const answered = lastAgent ? messages.indexOf(lastAgent) < messages.length - 1 : true;

  return {
    live,
    digest: dg && lastAgent ? { ...dg, from: lastAgent.who, when: lastAgent.when, messageId: lastAgent.id, open: !answered && !closed } : null,
    id: issue.id, title: friendlyTitle(issue), originalTitle: issue.title, key: issue.identifier,
    project: snap.projects.find(p => p.id === issue.project_id)?.title ?? null,
    url: `${process.env.MULTICA_APP_URL || "https://multica.ai"}/${snap.workspace.slug}/issues/${issue.identifier}`,
    status: issue.status, situation, mode, due: issue.due_date, dueText, dueFlag,
    assignee: { kind: issue.assignee_type, id: issue.assignee_id, name: agent?.name ?? member?.name ?? null, emoji: emoji(agent?.avatar_url), online: runtime?.status === "online" },
    brief: issue.description ?? "", messages, me: me.name, artifacts,
    people: [
      ...snap.members.filter(m => m.user_id !== me.id).map(m => ({ kind: "member" as const, id: m.user_id, name: m.name, emoji: null })),
      ...snap.agents.map(a => ({ kind: "agent" as const, id: a.id, name: a.name, emoji: emoji(a.avatar_url) })),
    ],
  };
}
