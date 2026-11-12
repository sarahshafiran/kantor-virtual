// Friendly titles. Order: a name you set in the app → the optional local list data/judul.json → the Multica title without its code.
// data/judul.json is personal ({ "issue-id": "Friendly title" }) and is not committed; see data/judul.example.json.
import { readFileSync } from "node:fs";
import { join } from "node:path";

let MAP: Record<string, string> | null = null;
function titles() {
  if (MAP) return MAP;
  try { MAP = JSON.parse(readFileSync(join(process.cwd(), "data", "judul.json"), "utf8")) as Record<string, string>; }
  catch { MAP = {}; }
  return MAP;
}
const CODE_PREFIX = /^\s*(?:[A-Z]{1,4}\d*-\d+[a-z]?|GATE)\s*[·:\-–—]\s*/;

export function cleanTitle(title: string) {
  let t = title;
  for (let i = 0; i < 2; i++) t = t.replace(CODE_PREFIX, "");
  return t.replace(/^GATE:\s*/i, "");
}

export function friendlyTitle(i: { id: string; title: string; metadata?: Record<string, unknown> }) {
  const custom = i.metadata?.kantor_title;
  if (typeof custom === "string" && custom.trim()) return custom.trim();
  return titles()[i.id] ?? cleanTitle(i.title);
}
