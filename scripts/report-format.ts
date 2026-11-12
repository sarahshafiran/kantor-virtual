// Adds the Kantor Virtual report format (## Summary / ## Questions) to every agent's instructions,
// so the task pop-up can show a short summary and one-by-one question cards.
// Safe to run again: agents that already have it are skipped. Use --dry to only list what would change.
//   npm run agents:format -- --dry
//   npm run agents:format
import { workspaces, loadDirectory, updateAgent, call_ } from "../lib/multica";
import { AGENT_REPORT_FORMAT, FORMAT_MARKER } from "../lib/digest";

const dry = process.argv.includes("--dry");

async function main() {
  for (const w of await workspaces()) {
    const { agents } = await loadDirectory(w.id);
    for (const a of agents) {
      const full = await call_<{ instructions?: string | null }>("GET", `/api/agents/${a.id}`, w.id);
      const cur = full.instructions ?? "";
      if (cur.includes(FORMAT_MARKER)) { console.log(`= ${w.name} · ${a.name}: already has it`); continue; }
      if (dry) { console.log(`+ ${w.name} · ${a.name}: would add the format`); continue; }
      try {
        await updateAgent(w.id, a.id, { instructions: (cur.trim() ? cur.trimEnd() + "\n" : "") + AGENT_REPORT_FORMAT });
        console.log(`+ ${w.name} · ${a.name}: added`);
      } catch (e) { console.log(`! ${w.name} · ${a.name}: ${e instanceof Error ? e.message.slice(0, 160) : e}`); }
    }
  }
}
main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
