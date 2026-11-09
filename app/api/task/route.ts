import { NextResponse } from "next/server";
import { createIssue, kantorSettings, setIssueMeta } from "@/lib/multica";
import { PARK_KEY } from "@/lib/office-control";

export const dynamic = "force-dynamic";

/** Beri task baru ke worker. */
export async function POST(req: Request) {
  const b = (await req.json()) as { files?: string[]; ws?: string; agentId: string; title: string; detail?: string; due?: string; projectId?: string; now?: boolean };
  if (!b.title?.trim()) return NextResponse.json({ error: "Judul task masih kosong." }, { status: 400 });
  try {
    const closed = (await kantorSettings(b.ws ?? null)).open === false;
    const created = await createIssue(b.ws ?? null, {
      title: b.title.trim(),
      description: b.detail?.trim() || null,
      // "Simpan untuk nanti" masuk backlog; "Kerjakan sekarang" masuk antrean.
      status: b.now === false || closed ? "backlog" : "todo",
      priority: "medium",
      assignee_type: "agent",
      assignee_id: b.agentId,
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
