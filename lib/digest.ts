// Reads an agent's result message and pulls out the short summary and the questions it needs a human to answer.
// Agents are asked to write "## Summary" and "## Questions" sections (see AGENT_REPORT_FORMAT); for older
// messages we fall back to the first paragraph and any numbered/bulleted line that ends with "?".

export type Question = { n: number; text: string; options: string[] };
export type Digest = { summary: string[]; questions: Question[]; structured: boolean };

/** Appended to every agent's instructions so results are easy to review in Kantor Virtual. */
export const AGENT_REPORT_FORMAT = `
## Kantor Virtual report format
Every result or update you post on an issue must start with these sections, in the member's language:

## Summary
- 1 to 3 short bullets with the key result a human needs to review. No background, no process.

## Questions
(Only when you need a decision or confirmation from a human.)
1. One question per line, answerable on its own.
   If there are fixed choices, end the line with: Options: A / B / C

Put the full details after these sections.`;
export const FORMAT_MARKER = "## Kantor Virtual report format";

const SUMMARY_H = /^(summary|ringkasan|tl;?\s?dr|key (result|points?)|hasil utama|intinya)\b/i;
const QUESTION_H = /^(questions?|pertanyaan|decisions?( needed)?|needs? (your )?(decision|confirmation|input)|perlu (konfirmasi|keputusan)|butuh (konfirmasi|keputusan))\b/i;
const YESNO = /^(should|is|are|do|does|did|can|could|would|will|shall|may|apakah|boleh|perlu|mau|bisakah|sudahkah)\b/i;

const strip = (s: string) => s.replace(/\*\*|__|`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").trim();

function sections(md: string) {
  const out: { head: string; body: string[] }[] = [{ head: "", body: [] }];
  for (const line of md.split("\n")) {
    const h = line.match(/^#{1,4}\s+(.+?)\s*:?\s*$/) ?? line.match(/^\*\*([^*]+?):?\*\*\s*:?\s*$/);
    if (h) out.push({ head: strip(h[1]).replace(/^[^\p{L}]+/u, ""), body: [] });
    else out[out.length - 1].body.push(line);
  }
  return out;
}

function items(lines: string[]) {
  const out: string[] = [];
  for (const raw of lines) {
    const m = raw.match(/^\s{0,3}(?:\d+[.)]|[-*•])\s+(.*)$/);
    // Only indented lines continue a list item; a new paragraph ("Next: …") ends it.
    if (m) out.push(m[1].trim());
    else if (raw.trim() && out.length && /^\s{2,}/.test(raw)) out[out.length - 1] += " " + raw.trim();
  }
  return out;
}

function toQuestion(text: string, n: number): Question {
  let t = text, options: string[] = [];
  const opt = t.match(/\s*(?:options?|pilihan)\s*:\s*(.+)$/i);
  if (opt) { options = opt[1].split(/\s*\/\s*|\s*,\s*|\s+or\s+|\s+atau\s+/i).map(strip).filter(Boolean).slice(0, 6); t = t.slice(0, opt.index); }
  const q = strip(t);
  // "A or B?" is a choice, not a yes/no question: leave it as free text.
  if (!options.length && !/,?\s(or|atau)\s/i.test(q) && YESNO.test(q.replace(/^[^\p{L}]+/u, "").replace(/^(for|untuk)\s+[^,]+,\s*/i, ""))) options = ["Yes", "No"];
  return { n, text: q, options };
}

export function digest(md: string): Digest | null {
  if (!md?.trim()) return null;
  const secs = sections(md);
  const sum = secs.find(s => SUMMARY_H.test(s.head));
  const qs = secs.find(s => QUESTION_H.test(s.head));
  let summary = sum ? items(sum.body).map(strip) : [];
  if (sum && !summary.length) summary = [strip(sum.body.join(" ").trim())].filter(Boolean);
  let questions = qs ? items(qs.body).map((t, i) => toQuestion(t, i + 1)) : [];
  if (!qs) {
    // Older messages: any list line that asks something.
    questions = items(md.split("\n").filter(l => /^\s{0,3}(\d+[.)]|[-*•])\s+/.test(l)))
      .filter(t => /\?/.test(t)).slice(0, 8).map((t, i) => {
        const cut = t.slice(0, t.lastIndexOf("?") + 1);
        return toQuestion(cut, i + 1);
      });
  }
  if (!summary.length) {
    const para = md.split(/\n\s*\n/).map(p => p.trim()).find(p => p && !/^#/.test(p) && !/^\s*(\d+[.)]|[-*•])\s/.test(p) && !/^\|/.test(p));
    if (para) { const s = strip(para.replace(/\n/g, " ")); summary = [s.length > 280 ? s.slice(0, 277).replace(/\s+\S*$/, "") + "…" : s]; }
  }
  if (!summary.length && !questions.length) return null;
  return { summary: summary.slice(0, 4), questions, structured: !!(sum || qs) };
}

/** Turns answered question cards into one tidy reply. */
export function answersToText(qs: Question[], answers: Record<number, string>) {
  const done = qs.filter(q => answers[q.n]?.trim());
  if (!done.length) return "";
  return "**Answers**\n" + done.map(q => `${q.n}. ${q.text.length > 90 ? q.text.slice(0, 87) + "…" : q.text}\n   → ${answers[q.n].trim()}`).join("\n");
}
