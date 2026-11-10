"use client";
// Pilih tema warna (Ceria, Laut, Hutan, Pastel, Klasik) dan mode tampilan (Otomatis/Terang/Gelap).
// Disimpan di browser masing-masing, jadi tiap orang bisa punya tampilan sendiri.
import { useEffect, useRef, useState } from "react";

type Mode = "auto" | "light" | "dark";
export const PALETTES = [
  { id: "ceria", name: "Ceria", dots: ["#FF69B4", "#FFEA00", "#00D9C0", "#FF6B35", "#A259FF"] },
  { id: "laut", name: "Laut", dots: ["#2F80ED", "#FFD23F", "#00B8D9", "#FF7A59", "#5B5BD6"] },
  { id: "hutan", name: "Hutan", dots: ["#3E9B5F", "#F2C14E", "#4FB3A9", "#E07A3F", "#8C6BB1"] },
  { id: "pastel", name: "Pastel", dots: ["#F4A6C6", "#FFE38A", "#9EDFD3", "#FFB38A", "#C3B1F5"] },
  { id: "klasik", name: "Klasik", dots: ["#C2683F", "#E8B04A", "#5E9C8F", "#D9822B", "#8A6F9E"] },
] as const;
const MODES: { id: Mode; label: string }[] = [{ id: "auto", label: "🖥️ Otomatis" }, { id: "light", label: "☀️ Terang" }, { id: "dark", label: "🌙 Gelap" }];

const store = (k: string, v: string | null) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} };

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("auto");
  const [pal, setPal] = useState("ceria");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const t = localStorage.getItem("kantor-theme"); if (t === "light" || t === "dark") setMode(t);
      const p = localStorage.getItem("kantor-palette"); if (p && PALETTES.some(x => x.id === p)) setPal(p);
    } catch {}
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const pickMode = (m: Mode) => {
    setMode(m);
    if (m === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = m;
    store("kantor-theme", m === "auto" ? null : m);
    window.dispatchEvent(new Event("kantor:theme"));
  };
  const pickPal = (p: string) => {
    setPal(p);
    if (p === "ceria") delete document.documentElement.dataset.palette; else document.documentElement.dataset.palette = p;
    store("kantor-palette", p === "ceria" ? null : p);
    window.dispatchEvent(new Event("kantor:theme"));
  };
  const cur = PALETTES.find(p => p.id === pal) ?? PALETTES[0];

  return (
    <div className="themepick" ref={box}>
      <button className="btn sm" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-haspopup="dialog" title="Ganti tema warna dan mode terang/gelap">
        🎨 {cur.name} · {MODES.find(m => m.id === mode)!.label.split(" ")[0]}
      </button>
      {open && (
        <div className="tp-pop" role="dialog" aria-label="Pilih tema">
          <div className="tp-h">Tema warna</div>
          <div className="tp-pals">
            {PALETTES.map(p => (
              <button key={p.id} className={`tp-pal ${p.id === pal ? "on" : ""}`} onClick={() => pickPal(p.id)} aria-pressed={p.id === pal}>
                <span className="tp-dots">{p.dots.map(c => <i key={c} style={{ background: c }} />)}</span>{p.name}
              </button>
            ))}
          </div>
          <div className="tp-h">Mode</div>
          <div className="tp-modes">
            {MODES.map(m => <button key={m.id} className={`tp-mode ${m.id === mode ? "on" : ""}`} onClick={() => pickMode(m.id)} aria-pressed={m.id === mode}>{m.label}</button>)}
          </div>
          <small className="tp-note">Tersimpan di browser ini saja, jadi tiap orang bisa punya tampilan sendiri.</small>
        </div>
      )}
    </div>
  );
}
