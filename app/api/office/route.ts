import { NextResponse } from "next/server";
import { planOffice, closeOffice, openOffice } from "@/lib/office-control";

export const dynamic = "force-dynamic";

/** Pratinjau: apa yang akan terjadi kalau kantor ditutup / dibuka. Tidak mengubah apa pun. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const ws = u.searchParams.get("ws"); const action = u.searchParams.get("action");
  if (!ws || (action !== "close" && action !== "open")) return NextResponse.json({ error: "Incomplete request." }, { status: 400 });
  try { return NextResponse.json(await planOffice(ws, action)); }
  catch (e) { return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 }); }
}

export async function POST(req: Request) {
  const b = (await req.json()) as { ws?: string; action?: "close" | "open"; stopRunning?: boolean };
  if (!b.ws || (b.action !== "close" && b.action !== "open")) return NextResponse.json({ error: "Incomplete request." }, { status: 400 });
  try {
    const result = b.action === "close" ? await closeOffice(b.ws, !!b.stopRunning) : await openOffice(b.ws);
    return NextResponse.json({ ok: true, result });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
