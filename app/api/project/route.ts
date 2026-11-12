import { NextResponse } from "next/server";
import { createProject } from "@/lib/multica";

export const dynamic = "force-dynamic";

/** Create a project (a new room in the office). */
export async function POST(req: Request) {
  const b = (await req.json()) as { ws?: string; title?: string; icon?: string; description?: string; due?: string; leadType?: "agent" | "member" | ""; leadId?: string };
  const title = (b.title ?? "").trim();
  if (!title) return NextResponse.json({ error: "Give the project a name first." }, { status: 400 });
  try {
    const base = { title, icon: b.icon?.trim() || null, description: b.description?.trim() || null, status: "in_progress", priority: "medium", due_date: b.due || null };
    const lead = b.leadType && b.leadId ? { lead_type: b.leadType, lead_id: b.leadId } : null;
    // If Multica rejects the lead, still create the project without one.
    const p = lead ? await createProject(b.ws ?? null, { ...base, ...lead }).catch(() => createProject(b.ws ?? null, base)) : await createProject(b.ws ?? null, base);
    return NextResponse.json({ id: p.id, title: p.title });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
