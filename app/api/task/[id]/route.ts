import { NextResponse } from "next/server";
import { buildDetail } from "@/lib/detail";
import { addComment, updateIssue, setIssueMeta, issueDetail, me, kantorSettings, rerunIssue, loadDirectory } from "@/lib/multica";
import { parseMentions, plainText } from "@/lib/mentions";
import { telegram } from "@/lib/telegram";
import { friendlyTitle } from "@/lib/titles";
import { parkIssue } from "@/lib/office-control";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = new URL(req.url).searchParams.get("ws");
  try { return NextResponse.json(await buildDetail(id, ws)); }
  catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}

type Body = { ws?: string; files?: string[]; action: "approve" | "revise" | "reply" | "done" | "rename" | "rerun"; text?: string; link?: string };

/** Aksi dari kantor. Setiap aksi ditulis ke Multica atas nama pemilik token. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;
  const text = (body.text ?? "").trim();
  const files = body.files ?? [];
  try {
    const ws = body.ws ?? null;
    const { issue } = await issueDetail(id, ws);
    const who = (await me()).name;
    // Kantor tutup: pesan tetap tercatat, tapi worker baru mengerjakannya saat kantor dibuka.
    const officeClosed = (await kantorSettings(ws)).open === false;
    const closed = officeClosed && issue.assignee_type === "agent";
    // Agen yang dipanggil dengan @ langsung merespons (Multica membangunkannya), kecuali kantor sedang tutup.
    const mentions = body.action === "rename" ? [] : parseMentions(text);
    const mutedMentions = officeClosed ? mentions.filter(m => m.kind === "agent").map(m => m.id) : [];
    const quiet = [...(issue.assignee_type === "agent" && issue.assignee_id ? [issue.assignee_id] : []), ...mutedMentions];
    switch (body.action) {
      case "approve":
        // Komentar persetujuan tidak membangunkan agen (hemat token), lalu task ditutup.
        await addComment(ws, id, `✅ Approved by ${who} in Virtual Office.${text ? `\n\n${text}` : ""}`, quiet, files);
        await updateIssue(ws, id, { status: "done" });
        break;
      case "revise":
        if (!text && !files.length) return NextResponse.json({ error: "The change request is empty." }, { status: 400 });
        // Komentar biasa membangunkan agen yang ditugaskan; status kembali ke antrean.
        if (closed) {
          await addComment(ws, id, `✏️ Changes requested:\n\n${text}`, quiet, files);
          await parkIssue(ws, id, "todo");
        } else {
          await addComment(ws, id, `✏️ Changes requested:\n\n${text}`, mutedMentions, files);
          await updateIssue(ws, id, { status: "todo" });
        }
        break;
      case "reply":
        if (!text && !files.length) return NextResponse.json({ error: "The message is empty." }, { status: 400 });
        if (closed) { await addComment(ws, id, text, quiet, files); await parkIssue(ws, id, issue.status === "in_progress" ? "in_progress" : "todo"); }
        else await addComment(ws, id, text, mutedMentions, files);
        break;
      case "done":
        await addComment(ws, id, `✅ Done by ${who}.${body.link ? `\n\nLink: ${body.link}` : ""}${text ? `\n\n${text}` : ""}`, quiet, files);
        await updateIssue(ws, id, { status: "done" });
        break;
      case "rerun":
        // Ulangi kerja worker untuk task ini (misalnya setelah login AI diperbaiki).
        await rerunIssue(ws, id);
        break;
      case "rename":
        await setIssueMeta(ws, id, "kantor_title", text);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }
    // Manusia yang dipanggil: Multica sudah menaruhnya di Kabar Masuk mereka. Kalau Telegram kantor disambungkan, kirim juga ke sana.
    const people = mentions.filter(m => m.kind === "member");
    if (people.length) {
      const dir = await loadDirectory(ws).catch(() => null);
      if (dir) {
        const tg = { id: dir.workspace.id, slug: dir.workspace.slug, name: dir.workspace.name, members: dir.members.map(m => m.name) };
        const excerpt = plainText(text).slice(0, 280);
        for (const p of people) {
          const name = dir.members.find(m => m.user_id === p.id || m.id === p.id)?.name ?? p.name;
          if (name === who) continue;
          // Tidak ditunggu: Telegram kadang lambat, balasan ke layar jangan ikut tertahan.
          void telegram(`📣 **${who}** mentioned you in "${friendlyTitle(issue)}"\n\n${excerpt}\n\nOpen Virtual Office to reply.`, name, tg).catch(() => 0);
        }
      }
    }
    return NextResponse.json(await buildDetail(id, ws));
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
