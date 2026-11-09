import { NextResponse } from "next/server";
import { uploadFile } from "@/lib/multica";

export const dynamic = "force-dynamic";

/** Unggah lampiran (gambar, dokumen) ke Multica. Mengembalikan id lampiran untuk dikirim bersama pesan/task. */
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const ws = String(form.get("ws") ?? "") || null;
    const issueId = String(form.get("issueId") ?? "") || undefined;
    const files = form.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (!files.length) return NextResponse.json({ error: "Tidak ada file." }, { status: 400 });
    const uploaded = [];
    for (const f of files) uploaded.push(await uploadFile(ws, f, issueId));
    return NextResponse.json({ files: uploaded.map(u => ({ id: u.id, name: u.filename })) });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
