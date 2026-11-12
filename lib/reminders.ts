// Reminders: a short message sent to someone's Telegram at a chosen time.
// Stored as a hidden Multica task, so assistants can make one with the multica CLI:
//   title       "⏰ <what to remember>"
//   assignee    the person to remind
//   description first line "Remind at: YYYY-MM-DD HH:MM" (office time zone), notes below
// Reminders made in Virtual Office also keep the time in metadata (kantor_remind_at, ISO).
// The office watchdog sends it once the time has passed, then marks the task done.
import "server-only";
import { workspace, allIssues, createIssue, updateIssue, setIssueMeta, call_, isReminder, REMIND_PREFIX, type Issue } from "./multica";

export const REMIND_META = "kantor_remind_at";
const tz = () => process.env.KANTOR_TIMEZONE || "Asia/Jakarta";
const OPEN = (i: Issue) => !["done", "cancelled", "canceled"].includes(i.status);

/** "2026-11-12" + "15:00" in the office time zone → UTC Date. */
export function zonedTime(date: string, time: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date), t = /^(\d{1,2})[:.](\d{2})$/.exec(time);
  if (!m || !t) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]);
  // How far the zone is from UTC at that moment (handles zones with daylight saving too).
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz(), hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (shown - guess));
}

/** When a reminder should go out, from its metadata or the "Remind at:" line. Date only → 09:00. */
export function remindAt(i: Issue, description?: string | null): Date | null {
  const meta = (i.metadata ?? {})[REMIND_META];
  if (typeof meta === "string" && Number.isFinite(Date.parse(meta))) return new Date(meta);
  const hit = /remind(?:\s+me)?\s+at\s*:?\s*(\d{4}-\d{2}-\d{2})(?:[ T,]+(\d{1,2}[:.]\d{2}))?/i.exec(description ?? "")
    ?? /ingatkan\s*(?:pada|jam)?\s*:?\s*(\d{4}-\d{2}-\d{2})(?:[ T,]+(\d{1,2}[:.]\d{2}))?/i.exec(description ?? "");
  if (hit) return zonedTime(hit[1], hit[2] ?? "09:00");
  return i.due_date ? zonedTime(i.due_date.slice(0, 10), "09:00") : null;
}

/** The notes under the "Remind at:" line, if any. */
export function remindNotes(description?: string | null) {
  return (description ?? "").split("\n").filter(l => !/^\s*(remind(\s+me)?\s+at|ingatkan)\b/i.test(l)).join("\n").trim();
}

export const reminderText = (i: Issue) => i.title.slice(REMIND_PREFIX.length).replace(/^[\s:·-]+/, "").replace(/^reminder\s*[:·-]\s*/i, "").trim() || "Reminder";

export type ReminderView = { id: string; text: string; at: string | null; atText: string; who: string | null; late: boolean };

export function fmtWhen(d: Date) {
  const day = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(x);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz(), hour: "2-digit", minute: "2-digit" }).format(d);
  const today = day(new Date()), tomorrow = day(new Date(Date.now() + 86400000));
  if (day(d) === today) return `Today ${time}`;
  if (day(d) === tomorrow) return `Tomorrow ${time}`;
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz(), weekday: "short", day: "numeric", month: "short" }).format(d) + ` ${time}`;
}

async function description(wsId: string, id: string) {
  return (await call_<{ description?: string | null }>("GET", `/api/issues/${id}`, wsId)).description ?? null;
}

/** Upcoming reminders in this office, soonest first. */
export async function listReminders(wsPick: string | null | undefined, members: { id: string; user_id: string; name: string }[]): Promise<ReminderView[]> {
  const ws = await workspace(wsPick);
  const open = (await allIssues(ws.id)).filter(i => isReminder(i) && OPEN(i));
  const out = await Promise.all(open.map(async i => {
    const at = remindAt(i, (i.metadata ?? {})[REMIND_META] ? null : await description(ws.id, i.id).catch(() => null));
    const who = i.assignee_type === "member" ? members.find(m => m.id === i.assignee_id || m.user_id === i.assignee_id)?.name ?? null : null;
    return { id: i.id, text: reminderText(i), at: at?.toISOString() ?? null, atText: at ? fmtWhen(at) : "No time set", who, late: !!at && at.getTime() < Date.now() };
  }));
  return out.sort((a, b) => (a.at ?? "9").localeCompare(b.at ?? "9"));
}

export async function addReminder(wsPick: string | null | undefined, text: string, at: Date, assigneeId: string | null, notes = "") {
  const ws = await workspace(wsPick);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: tz() }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: tz(), hour: "2-digit", minute: "2-digit" }).format(at);
  const issue = await createIssue(ws.id, {
    title: `${REMIND_PREFIX} ${text.trim()}`, status: "todo", priority: "none", due_date: day,
    description: `Remind at: ${day} ${time}${notes.trim() ? "\n\n" + notes.trim() : ""}`,
    ...(assigneeId ? { assignee_type: "member", assignee_id: assigneeId } : {}),
  });
  await setIssueMeta(ws.id, issue.id, REMIND_META, at.toISOString());
  return issue.id;
}

export async function cancelReminder(wsPick: string | null | undefined, id: string) {
  return updateIssue(wsPick, id, { status: "cancelled" });
}

/** Instructions added to every agent so they know how to set a reminder. */
export const REMIND_MARKER = "## Kantor Virtual reminders";
export const AGENT_REMINDERS = `
${REMIND_MARKER}
You can send a person a Telegram reminder at a set time. When someone asks to be reminded, create a hidden reminder task with the multica CLI (do not reply that you cannot send reminders):

multica issue create --title "${REMIND_PREFIX} <what to remember, short>" --assignee "<person to remind>" --status todo --due-date YYYY-MM-DD --description "Remind at: YYYY-MM-DD HH:MM"

- Time is ${process.env.KANTOR_TIMEZONE || "Asia/Jakarta"} unless the person says otherwise; use 24-hour time. If they give no time, ask, or use 09:00.
- Put any extra notes on the lines after "Remind at:".
- One task per reminder. For repeating reminders, create the next few dates.
- Virtual Office sends it to their Telegram when the time comes (up to a few minutes late), then closes the task. Tell the person the date and time you set.
`;
