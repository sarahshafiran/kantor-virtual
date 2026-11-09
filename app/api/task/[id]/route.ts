import { NextResponse } from "next/server";
import { buildDetail } from "@/lib/detail";
import { addComment, updateIssue, setIssueMeta, issueDetail, me, kantorSettings, rerunIssue } from "@/lib/multica";
import { parkIssue } from "@/lib/office-control";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = new URL(req.url).searchParams.get("ws");
  try { return NextResponse.json(await buildDetail(id, ws)); }
  catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}

type Body = { ws?: string; action: "approve" | "revise" | "reply" | "done" | "rename" | "rerun"; text?: string; link?: string };

/** Aksi dari kantor. Setiap aksi ditulis ke Multica atas nama pemilik token. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;
  const text = (body.text ?? "").trim();
  try {
    const ws = body.ws ?? null;
    const { issue } = await issueDetail(id, ws);
    const who = (await me()).name;
    const quiet = issue.assignee_type === "agent" && issue.assignee_id ? [issue.assignee_id] : [];
    // Kantor tutup: pesan tetap tercatat, tapi worker baru mengerjakannya saat kantor dibuka.
    const closed = (await kantorSettings(ws)).open === false && issue.assignee_type === "agent";
    switch (body.action) {
      case "approve":
        // Komentar persetujuan tidak membangunkan agen (hemat token), lalu task ditutup.
        await addComment(ws, id, `✅ Disetujui oleh ${who} lewat Kantor Virtual.${text ? `\n\n${text}` : ""}`, quiet);
        await updateIssue(ws, id, { status: "done" });
        break;
      case "revise":
        if (!text) return NextResponse.json({ error: "Catatan revisi masih kosong." }, { status: 400 });
        // Komentar biasa membangunkan agen yang ditugaskan; status kembali ke antrean.
        if (closed) {
          await addComment(ws, id, `✏️ Minta revisi:\n\n${text}`, quiet);
          await parkIssue(ws, id, "todo");
        } else {
          await addComment(ws, id, `✏️ Minta revisi:\n\n${text}`);
          await updateIssue(ws, id, { status: "todo" });
        }
        break;
      case "reply":
        if (!text) return NextResponse.json({ error: "Pesannya masih kosong." }, { status: 400 });
        if (closed) { await addComment(ws, id, text, quiet); await parkIssue(ws, id, issue.status === "in_progress" ? "in_progress" : "todo"); }
        else await addComment(ws, id, text);
        break;
      case "done":
        await addComment(ws, id, `✅ Sudah dikerjakan oleh ${who}.${body.link ? `\n\nLink: ${body.link}` : ""}${text ? `\n\n${text}` : ""}`, quiet);
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
        return NextResponse.json({ error: "Aksi tidak dikenal." }, { status: 400 });
    }
    return NextResponse.json(await buildDetail(id, ws));
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
