"use client";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Px, PxSpan, rehypePx, type PxName } from "./pixel-icon";

type F = { id: string; name: string; url: string };
type Kind = "image" | "pdf" | "html" | "table" | "doc" | "text" | "other";

const ext = (n: string) => n.toLowerCase().split(".").pop() ?? "";
export function kindOf(name: string): Kind {
  const e = ext(name);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(e)) return "image";
  if (e === "pdf") return "pdf";
  if (["html", "htm"].includes(e)) return "html";
  if (["csv", "tsv"].includes(e)) return "table";
  if (["md", "markdown"].includes(e)) return "doc";
  if (["txt", "json", "log", "yaml", "yml"].includes(e)) return "text";
  return "other";
}
export const ICON: Record<Kind, PxName> = { image: "image", pdf: "pdf", html: "web", table: "chart", doc: "file", text: "file", other: "clip" };
const LABEL: Record<Kind, string> = { image: "Image", pdf: "PDF", html: "Web page", table: "Table", doc: "Document", text: "Text", other: "File" };

function parseTable(text: string, sep: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

function Body({ f, kind, tall }: { f: F; kind: Kind; tall?: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const needsText = kind === "html" || kind === "table" || kind === "doc" || kind === "text";
  useEffect(() => {
    if (!needsText) return;
    fetch(`${f.url}&mode=text`).then(async r => { if (!r.ok) throw new Error(await r.text()); return r.text(); }).then(setText).catch(e => setErr(String(e.message ?? e)));
  }, [f.url, needsText]);
  const h = tall ? "75vh" : 360;
  if (kind === "image") return <img src={f.url} alt={f.name} className="pv-img" />;
  if (kind === "pdf") return <iframe title={f.name} src={f.url} className="pv-frame" style={{ height: h }} />;
  if (err) return <p className="desc">Preview unavailable ({err.slice(0, 80)}). Download the file to open it.</p>;
  if (needsText && text === null) return <div className="loading"><span className="spinner sm" /> Loading preview…</div>;
  if (kind === "html") return <iframe title={f.name} srcDoc={text!} sandbox="allow-scripts" className="pv-frame" style={{ height: h, background: "#fff" }} />;
  if (kind === "table") {
    const rows = parseTable(text!, ext(f.name) === "tsv" ? "\t" : ",");
    const [head, ...rest] = rows;
    return (
      <div className="pv-table" style={{ maxHeight: h }}>
        <table><thead><tr>{head?.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
          <tbody>{rest.slice(0, 300).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody></table>
        {rest.length > 300 && <p className="desc">Showing 300 of {rest.length} rows.</p>}
      </div>
    );
  }
  if (kind === "doc") return <div className="md pv-doc" style={{ maxHeight: h }}><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypePx]} components={{ span: PxSpan }}>{text!}</ReactMarkdown></div>;
  if (kind === "text") return <pre className="pv-text" style={{ maxHeight: h }}>{text}</pre>;
  return <p className="desc">This file can't be previewed here. Download it to open.</p>;
}

/** Kartu lampiran dengan pratinjau seperti di Claude: halaman web, tabel, dokumen, gambar, PDF. */
export default function FilePreview({ f }: { f: F }) {
  const kind = kindOf(f.name);
  const [open, setOpen] = useState(kind === "image" || kind === "html" || kind === "table" || kind === "doc");
  const [full, setFull] = useState(false);
  return (
    <div className="pv">
      <div className="pv-head">
        <span className="pv-name"><Px name={ICON[kind]} /> {f.name} <small>{LABEL[kind]}</small></span>
        <span className="pv-actions">
          {kind !== "other" && <button className="btn sm" onClick={() => setOpen(!open)}>{open ? "Hide" : "View"}</button>}
          {kind !== "other" && <button className="btn sm" onClick={() => setFull(true)}>⤢ Expand</button>}
          <a className="btn sm" href={f.url} download={f.name}>Download</a>
        </span>
      </div>
      {open && <div className="pv-body"><Body f={f} kind={kind} /></div>}
      {full && (
        <>
          <div className="scrim" style={{ zIndex: 40 }} onClick={() => setFull(false)} />
          <div className="modal pv-modal" role="dialog" aria-modal="true" aria-label={f.name} style={{ zIndex: 41 }}>
            <div className="pv-head"><b><Px name={ICON[kind]} /> {f.name}</b><button className="x" onClick={() => setFull(false)} aria-label="Close"><Px name="close" size="1em" /></button></div>
            <Body f={f} kind={kind} tall />
          </div>
        </>
      )}
    </div>
  );
}
