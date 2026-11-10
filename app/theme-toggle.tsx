"use client";
// Tombol mode tampilan: Otomatis (ikut pengaturan Mac) → Terang → Gelap.
import { useEffect, useState } from "react";

type Mode = "auto" | "light" | "dark";
const NEXT: Record<Mode, Mode> = { auto: "light", light: "dark", dark: "auto" };
const LABEL: Record<Mode, string> = { auto: "🖥️ Otomatis", light: "☀️ Terang", dark: "🌙 Gelap" };

export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("auto");
  useEffect(() => {
    try { const t = localStorage.getItem("kantor-theme"); if (t === "light" || t === "dark") setMode(t); } catch {}
  }, []);
  const change = () => {
    const m = NEXT[mode]; setMode(m);
    if (m === "auto") delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = m;
    try { if (m === "auto") localStorage.removeItem("kantor-theme"); else localStorage.setItem("kantor-theme", m); } catch {}
  };
  return (
    <button className="btn sm" onClick={change} title="Ganti tampilan: otomatis (ikut Mac), terang, atau gelap" aria-label={`Tampilan: ${LABEL[mode]}. Klik untuk mengganti.`}>
      {LABEL[mode]}
    </button>
  );
}
