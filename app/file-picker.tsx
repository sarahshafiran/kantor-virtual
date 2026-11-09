"use client";
import { useRef } from "react";

const MAX_MB = 25;

/** Unggah file yang dipilih ke Multica, kembalikan id lampirannya. */
export async function uploadAll(files: File[], ws: string, issueId?: string): Promise<string[]> {
  const form = new FormData();
  form.append("ws", ws);
  if (issueId) form.append("issueId", issueId);
  for (const f of files) form.append("file", f, f.name);
  const r = await fetch("/api/upload", { method: "POST", body: form });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return (j.files as { id: string }[]).map(f => f.id);
}

/** Tombol lampiran + daftar file terpilih (bisa juga tempel gambar dengan Cmd+V di kolom pesan). */
export default function FilePicker({ files, onChange }: { files: File[]; onChange: (f: File[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const add = (list: FileList | null) => {
    if (!list) return;
    const ok = [...list].filter(f => f.size <= MAX_MB * 1024 * 1024);
    if (ok.length < list.length) alertLarge();
    onChange([...files, ...ok]);
  };
  return (
    <div className="picker">
      <input ref={input} id="lampiran" type="file" multiple hidden onChange={e => { add(e.target.files); e.target.value = ""; }} />
      <button type="button" className="btn sm" onClick={() => input.current?.click()}>📎 Lampirkan file</button>
      {files.map((f, i) => (
        <span key={f.name + i} className="chip">
          {f.type.startsWith("image/") ? "🖼️" : "📄"} {f.name}
          <button type="button" className="chipx" aria-label={`Hapus ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>✕</button>
        </span>
      ))}
    </div>
  );
}

function alertLarge() {
  // Tidak memakai alert() bawaan; cukup pesan di konsol dan file besar dilewati.
  console.warn(`File lebih dari ${MAX_MB} MB dilewati.`);
}
