import { fileRaw, fileText } from "@/lib/multica";

export const dynamic = "force-dynamic";

/** Lampiran lewat app sendiri: ?mode=text untuk pratinjau teks, selain itu file aslinya. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const u = new URL(req.url);
  const ws = u.searchParams.get("ws");
  try {
    if (u.searchParams.get("mode") === "text") {
      return new Response(await fileText(ws, id), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "private, max-age=60" } });
    }
    const res = await fileRaw(ws, id);
    if (!res.ok || !res.body) return new Response("File tidak bisa dibuka.", { status: res.status || 500 });
    const type = res.headers.get("content-type") ?? "application/octet-stream";
    const headers = new Headers({ "Content-Type": type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
    // Keamanan: HTML/SVG buatan agen tidak boleh berjalan di alamat app ini (pratinjaunya lewat bingkai terisolasi).
    if (/html|svg|xml|javascript/i.test(type)) {
      headers.set("Content-Type", "text/plain; charset=utf-8");
      headers.set("Content-Disposition", "attachment");
    } else {
      const cd = res.headers.get("content-disposition"); if (cd) headers.set("Content-Disposition", cd.replace(/^attachment/i, "inline"));
    }
    return new Response(res.body, { headers });
  } catch (e) {
    return new Response(String(e instanceof Error ? e.message : e), { status: 500 });
  }
}
