"use client";
// Kotak tulisan dengan @mention: ketik "@" lalu pilih teman (manusia atau agen).
import { useMemo, useRef, useState } from "react";
import type { Mentionable } from "@/lib/mentions";
import { Px } from "./pixel-icon";

type Props = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string; onChange: (v: string) => void;
  people: Mentionable[]; picked: Mentionable[]; onPick: (p: Mentionable[]) => void;
};

export default function MentionBox({ value, onChange, people, picked, onPick, ...rest }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [q, setQ] = useState<string | null>(null);
  const [at, setAt] = useState(0);
  const [hi, setHi] = useState(0);

  const matches = useMemo(() => q === null ? [] :
    people.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 7), [q, people]);

  function sync(text: string, caret: number) {
    const before = text.slice(0, caret);
    const m = before.match(/(^|\s)@([^\s@]{0,24})$/);
    if (m) { setQ(m[2]); setAt(caret - m[2].length - 1); setHi(0); } else setQ(null);
  }

  function choose(p: Mentionable) {
    const el = ref.current; if (!el) return;
    const caret = el.selectionStart;
    const next = value.slice(0, at) + "@" + p.name + " " + value.slice(caret);
    onChange(next);
    if (!picked.some(x => x.id === p.id)) onPick([...picked, p]);
    setQ(null);
    const pos = at + p.name.length + 2;
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(pos, pos); });
  }

  return (
    <div className="mbox">
      <textarea ref={ref} {...rest} value={value}
        onChange={e => { onChange(e.target.value); sync(e.target.value, e.target.selectionStart); }}
        onClick={e => sync(value, (e.target as HTMLTextAreaElement).selectionStart)}
        onBlur={() => setTimeout(() => setQ(null), 150)}
        onKeyDown={e => {
          if (q !== null && matches.length) {
            if (e.key === "ArrowDown") { e.preventDefault(); setHi((hi + 1) % matches.length); return; }
            if (e.key === "ArrowUp") { e.preventDefault(); setHi((hi - 1 + matches.length) % matches.length); return; }
            if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(matches[hi]); return; }
            if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setQ(null); return; }
          }
          rest.onKeyDown?.(e);
        }} />
      {q !== null && matches.length > 0 && (
        <ul className="mpop" role="listbox" aria-label="Pick who to mention">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === hi}>
              <button type="button" onMouseDown={e => { e.preventDefault(); choose(p); }} onMouseEnter={() => setHi(i)}>
                <span className="mp-av">{p.emoji ?? (p.kind === "agent" ? <Px name="agent" /> : p.name.slice(0, 1).toUpperCase())}</span>
                <span className="mp-name">{p.name}</span>
                <small>{p.kind === "agent" ? "agent · replies right away" : "person · gets notified"}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Tampilkan tautan mention sebagai label "@Nama" di dalam markdown. */
export const mentionLink = (p: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
  const { node: _n, ...a } = p;
  if (a.href?.startsWith("mention://")) return <span className={`mention m-${a.href.split("/")[2]}`}>{a.children}</span>;
  return <a {...a} target="_blank" rel="noreferrer" />;
};
export const keepMentionUrl = (url: string) => url.startsWith("mention://") ? url : /^(https?:|mailto:|\/|#)/i.test(url) ? url : "";
