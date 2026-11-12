import { NextResponse } from "next/server";
import { thread, send } from "@/lib/dm";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ user: string }> }) {
  const { user } = await ctx.params;
  try { return NextResponse.json(await thread(new URL(req.url).searchParams.get("ws"), user)); }
  catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}

export async function POST(req: Request, ctx: { params: Promise<{ user: string }> }) {
  const { user } = await ctx.params;
  const b = (await req.json()) as { ws?: string; text?: string };
  const text = (b.text ?? "").trim();
  if (!text) return NextResponse.json({ error: "The message is empty." }, { status: 400 });
  try { return NextResponse.json(await send(b.ws ?? null, user, text)); }
  catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}
