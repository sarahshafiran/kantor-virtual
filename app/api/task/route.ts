import { NextResponse } from "next/server";
import { createIssue } from "@/lib/multica";

export const dynamic = "force-dynamic";

/** Beri task baru ke worker. */
export async function POST(req: Request) {
  const b = (await req.json()) as { ws?: string; agentId: string; title: string; detail?: string; due?: string; projectId?: string; now?: boolean };
  if (!b.title?.trim()) return NextResponse.json({ error: "Judul task masih kosong." }, { status: 400 });
  try {
    const created = await createIssue(b.ws ?? null, {
      title: b.title.trim(),
      description: b.detail?.trim() || null,
      // "Simpan untuk nanti" masuk backlog; "Kerjakan sekarang" masuk antrean.
      status: b.now === false ? "backlog" : "todo",
      priority: "medium",
      assignee_type: "agent",
      assignee_id: b.agentId,
      project_id: b.projectId || null,
      due_date: b.due || null,
    });
    return NextResponse.json({ id: created.id });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
