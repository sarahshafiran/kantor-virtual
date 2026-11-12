import { NextResponse } from "next/server";
import { createWorkspace } from "@/lib/multica";

export const dynamic = "force-dynamic";

/** Create a new workspace (office). */
export async function POST(req: Request) {
  const b = (await req.json()) as { name?: string; description?: string };
  const name = (b.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Give the workspace a name first." }, { status: 400 });
  try {
    const ws = await createWorkspace(name, b.description);
    return NextResponse.json({ id: ws.id, slug: ws.slug, name: ws.name });
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e);
    const friendly = /disabled|restricted/i.test(msg) ? "Creating workspaces is turned off on this Multica server. Ask its admin to create one for you." : msg;
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
}
