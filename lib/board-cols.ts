// Board columns (used on the server and in the browser).
export type Col = "backlog" | "todo" | "in_progress" | "in_review" | "done";
export const COLS: { id: Col; icon: "queued" | "todo" | "doing" | "eyes" | "party"; title: string; sub: string }[] = [
  { id: "backlog", icon: "queued", title: "Backlog", sub: "parked for later" },
  { id: "todo", icon: "todo", title: "Ready", sub: "good to go" },
  { id: "in_progress", icon: "doing", title: "In progress", sub: "hands busy" },
  { id: "in_review", icon: "eyes", title: "Needs review", sub: "waiting for your eyes" },
  { id: "done", icon: "party", title: "Done", sub: "last 14 days" },
];
