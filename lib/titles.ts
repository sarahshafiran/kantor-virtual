// Judul yang mudah dipahami. Urutan: nama yang kamu ganti sendiri di app → daftar data/judul.json → judul Multica tanpa kode.
import judul from "@/data/judul.json";

const MAP = judul as Record<string, string>;
const CODE_PREFIX = /^\s*(?:[A-Z]{1,4}\d*-\d+[a-z]?|GATE)\s*[·:\-–—]\s*/;

export function cleanTitle(title: string) {
  let t = title;
  for (let i = 0; i < 2; i++) t = t.replace(CODE_PREFIX, "");
  return t.replace(/^GATE:\s*/i, "");
}

export function friendlyTitle(i: { id: string; title: string; metadata?: Record<string, unknown> }) {
  const custom = i.metadata?.kantor_title;
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return MAP[i.id] ?? cleanTitle(i.title);
}
