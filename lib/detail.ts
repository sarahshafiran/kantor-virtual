// Detail satu task dalam bahasa sehari-hari: siapa, sedang apa, apa yang perlu kamu lakukan.
import "server-only";
import { issueDetail, loadDirectory } from "./multica";
import { friendlyTitle } from "./titles";

export type Message = {
  id: string; who: string; whoKind: "agent" | "member" | "system"; emoji: string | null; when: string; text: string;
  images: { name: string; url: string }[]; files: { name: string; url: string }[];
};
export type TaskDetail = {
  id: string; title: string; originalTitle: string; key: string; project: string | null; url: string;
  status: string; situation: string; mode: "review" | "human" | "working" | "waiting" | "closed";
  due: string | null; dueText: string | null; dueFlag: "late" | "risk" | null;
  assignee: { kind: "agent" | "member" | null; id: string | null; name: string | null; emoji: string | null; online: boolean };
  brief: string; messages: Message[]; me: string;
};

const isImage = (f: { filename: string; content_type?: string }) =>
  (f.content_type ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(f.filename);

export async function buildDetail(id: string, wsPick?: string | null): Promise<TaskDetail> {
  const tz = process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
  const [{ issue, comments, attachments, me }, snap] = await Promise.all([issueDetail(id, wsPick), loadDirectory(wsPick)]);
  const agent = issue.assignee_type === "agent" ? snap.agents.find(a => a.id === issue.assignee_id) : undefined;
  const member = issue.assignee_type === "member" ? snap.members.find(m => m.id === issue.assignee_id || m.user_id === issue.assignee_id) : undefined;
  const runtime = agent ? snap.runtimes.find(r => r.id === agent.runtime_id) : undefined;
  const emoji = (u?: string | null) => (u?.startsWith("emoji:") ? u.slice(6) : null);
  const nameOf = (kind: string, aid: string) => kind === "agent"
    ? snap.agents.find(a => a.id === aid)?.name ?? "Agen"
    : snap.members.find(m => m.id === aid || m.user_id === aid)?.name ?? "Anggota";
  const emojiOf = (kind: string, aid: string) => (kind === "agent" ? emoji(snap.agents.find(a => a.id === aid)?.avatar_url) : null);
  const when = (iso: string) => new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  const files = (list: { filename: string; url: string; download_url?: string; content_type?: string }[]) => ({
    images: list.filter(isImage).map(f => ({ name: f.filename, url: f.download_url || f.url })),
    files: list.filter(f => !isImage(f)).map(f => ({ name: f.filename, url: f.download_url || f.url })),
  });

  const messages: Message[] = comments
    .filter(c => !c.deleted_at)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
    .map(c => ({
      id: c.id, who: nameOf(c.author_type, c.author_id), whoKind: c.author_type === "agent" ? "agent" : c.author_type === "member" ? "member" : "system",
      emoji: emojiOf(c.author_type, c.author_id), when: when(c.created_at), text: c.content, ...files(c.attachments ?? []),
    }));
  // Lampiran yang tidak menempel di komentar mana pun ditampilkan sebagai pesan terpisah.
  const inComments = new Set(comments.flatMap(c => (c.attachments ?? []).map(a => a.id)));
  const loose = attachments.filter(a => !inComments.has(a.id));
  if (loose.length) messages.push({ id: "lampiran", who: "Lampiran", whoKind: "system", emoji: "📎", when: "", text: "", ...files(loose) });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  let dueFlag: TaskDetail["dueFlag"] = null, dueText: string | null = null;
  if (issue.due_date) {
    const d = Math.round((Date.parse(issue.due_date) - Date.parse(today)) / 86400000);
    const nice = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long" }).format(new Date(issue.due_date + "T00:00:00"));
    if (d < 0) { dueFlag = "late"; dueText = `Telat ${-d} hari (tenggat ${nice})`; }
    else if (d <= 2) { dueFlag = "risk"; dueText = d === 0 ? "Tenggat hari ini" : d === 1 ? "Tenggat besok" : `Tenggat ${nice}`; }
    else dueText = `Tenggat ${nice}`;
  }

  const closed = ["done", "cancelled", "canceled"].includes(issue.status);
  const lastIsAgentQuestion = messages.length > 0 && messages[messages.length - 1].whoKind === "agent" && /\?\s*$/.test(messages[messages.length - 1].text.trim());
  let mode: TaskDetail["mode"]; let situation: string;
  const aName = agent?.name ?? member?.name ?? "belum ada";
  if (closed) { mode = "closed"; situation = "Sudah selesai."; }
  else if (issue.assignee_type === "member") { mode = "human"; situation = `Tugas untuk ${member?.name ?? "manusia"}. Agen menunggu sampai ini dikonfirmasi sudah dikerjakan.`; }
  else if (issue.status === "in_review") { mode = "review"; situation = `${aName} sudah selesai dan menunggu review-mu.`; }
  else if (lastIsAgentQuestion) { mode = "waiting"; situation = `${aName} menunggu jawabanmu.`; }
  else if (issue.status === "in_progress") { mode = "working"; situation = runtime?.status === "online" ? `${aName} sedang mengerjakan ini.` : `${aName} akan lanjut saat kantor buka (laptop menyala).`; }
  else if (issue.status === "todo") { mode = "working"; situation = `Ada di antrean ${aName}, siap dikerjakan.`; }
  else { mode = "working"; situation = `Masih di backlog ${aName}, belum waktunya dikerjakan.`; }

  return {
    id: issue.id, title: friendlyTitle(issue), originalTitle: issue.title, key: issue.identifier,
    project: snap.projects.find(p => p.id === issue.project_id)?.title ?? null,
    url: `${process.env.MULTICA_APP_URL || "https://multica.ai"}/${snap.workspace.slug}/issues/${issue.identifier}`,
    status: issue.status, situation, mode, due: issue.due_date, dueText, dueFlag,
    assignee: { kind: issue.assignee_type, id: issue.assignee_id, name: agent?.name ?? member?.name ?? null, emoji: emoji(agent?.avatar_url), online: runtime?.status === "online" },
    brief: issue.description ?? "", messages, me: me.name,
  };
}
