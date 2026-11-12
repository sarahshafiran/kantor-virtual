import { NextResponse } from "next/server";
import { createIssue, kantorSettings, setIssueMeta } from "@/lib/multica";
import { PARK_KEY } from "@/lib/office-control";

export const dynamic = "force-dynamic";

/** Beri task baru ke worker. */
export async function POST(req: Request) {
  const b = (await req.json()) as { files?: string[]; ws?: string; agentId?: string; assigneeType?: "agent" | "member" | null; assigneeId?: string | null; title: string; detail?: string; due?: string; projectId?: string; now?: boolean };
  // Judul kosong: ambil baris pertama detail (tanpa tanda markdown) sebagai judul.
  if (!b.title?.trim()) b.title = (b.detail ?? "").split("\n").map(l => l.replace(/^[\s#>*\-\d.)]+/, "").replace(/[*_`]/g, "").trim()).find(Boolean)?.slice(0, 80) ?? "";
  if (!b.title?.trim()) return NextResponse.json({ error: "Add a title or some details first." }, { status: 400 });
  try {
    // Penerima: agen (bawaan, dari meja kantor) atau manusia / belum ada (dari Papan Kerjaan).
    const type = b.assigneeType === undefined ? "agent" : b.assigneeType;
    const who = type ? (b.assigneeId ?? b.agentId ?? null) : null;
    const closed = (await kantorSettings(b.ws ?? null)).open === false && type === "agent";
    const created = await createIssue(b.ws ?? null, {
      title: b.title.trim(),
      description: b.detail?.trim() || null,
      // "Simpan untuk nanti" masuk backlog; "Kerjakan sekarang" masuk antrean.
      status: b.now === false || closed ? "backlog" : "todo",
      priority: "medium",
      assignee_type: who ? type : null,
      assignee_id: who,
      project_id: b.projectId || null,
      due_date: b.due || null,
      attachment_ids: b.files?.length ? b.files : undefined,
    });
    // Kantor tutup: task diparkir dan otomatis dikerjakan saat kantor dibuka.
    if (closed && b.now !== false) await setIssueMeta(b.ws ?? null, created.id, PARK_KEY, "todo");
    return NextResponse.json({ id: created.id, parked: closed && b.now !== false });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
