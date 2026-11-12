// Mention ala Multica: [@Nama](mention://member/<user_id>) atau [@Nama](mention://agent/<agent_id>).
// Dipakai di browser (mengubah "@Nama" jadi tautan mention) dan di server (membaca siapa yang dipanggil).

export type Mentionable = { kind: "member" | "agent"; id: string; name: string; emoji: string | null };

const RE = /\[@?([^\]]+?)\]\(mention:\/\/(member|agent)\/([0-9a-fA-F-]+)\)/g;

/** Ganti "@Nama" yang dipilih dari daftar menjadi tautan mention Multica. */
export function encodeMentions(text: string, picked: Mentionable[]) {
  let out = text;
  // Nama terpanjang dulu, supaya "@Ara Putri" tidak terpotong oleh "@Ara".
  for (const p of [...picked].sort((a, b) => b.name.length - a.name.length)) {
    const tag = "@" + p.name;
    const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`(^|[^\\[\\w])${esc}(?![\\w])`, "g"), `$1[${tag}](mention://${p.kind}/${p.id})`);
  }
  return out;
}

export function parseMentions(text: string) {
  const out: { kind: "member" | "agent"; id: string; name: string }[] = [];
  for (const m of text.matchAll(RE)) if (!out.some(o => o.id === m[3])) out.push({ kind: m[2] as "member" | "agent", id: m[3], name: m[1] });
  return out;
}

/** Teks polos untuk notifikasi: tautan mention jadi "@Nama", markdown dibuang. */
export function plainText(text: string) {
  return text.replace(RE, "@$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
}
