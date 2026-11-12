import { NextResponse } from "next/server";
import { inviteMember, createAgent, loadDirectory, updateAgent, workspace, me } from "@/lib/multica";
import { AGENT_REPORT_FORMAT, FORMAT_MARKER } from "@/lib/digest";
import { AGENT_REMINDERS, REMIND_MARKER } from "@/lib/reminders";

export const dynamic = "force-dynamic";

type Body =
  | { ws?: string; kind: "human"; email: string; role?: "member" | "admin" }
  | { ws?: string; kind: "agent"; name: string; emoji?: string; role: string; instructions?: string; runtimeId: string };

/** Add to the team: invite a person by email, or create an AI agent. */
export async function POST(req: Request) {
  const b = (await req.json()) as Body;
  const ws = b.ws ?? null;
  try {
    if (b.kind === "human") {
      const email = (b.email ?? "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "That email address doesn't look right." }, { status: 400 });
      await inviteMember(ws, email, b.role === "admin" ? "admin" : "member");
      return NextResponse.json({ ok: true, message: `Invite sent to ${email}. They join the team once they accept.` });
    }
    if (b.kind === "agent") {
      const name = (b.name ?? "").trim(), role = (b.role ?? "").trim();
      if (!name) return NextResponse.json({ error: "Give the agent a name first." }, { status: 400 });
      if (!b.runtimeId) return NextResponse.json({ error: "Pick an AI engine for this agent." }, { status: 400 });
      const dir = await loadDirectory(ws);
      if (dir.agents.some(a => a.name.toLowerCase() === name.toLowerCase())) return NextResponse.json({ error: `There is already an agent called ${name}.` }, { status: 400 });
      const instructions = b.instructions?.trim() ||
        `You are ${name}, a member of the "${dir.workspace.name}" team. Your role: ${role || "general helper"}.\n` +
        "Reply in the language the member uses (usually Indonesian). Keep answers short and concrete, " +
        "post results and files on the issue, and move the issue to in_review when your part is done so a human can check it.";
      const agent = await createAgent(ws, {
        name, description: role, instructions: [instructions, instructions.includes(FORMAT_MARKER) ? "" : AGENT_REPORT_FORMAT, instructions.includes(REMIND_MARKER) ? "" : AGENT_REMINDERS].filter(Boolean).join("\n"), runtime_id: b.runtimeId, visibility: "workspace", max_concurrent_tasks: 2,
        avatar_url: b.emoji?.trim() ? `emoji:${b.emoji.trim()}` : null,
      });
      return NextResponse.json({ ok: true, id: agent.id, message: `${name} joined the team! Give them a first task from the Task Board.` });
    }
    return NextResponse.json({ error: "Unknown team member type." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}

/** Switch an agent to another AI engine. */
export async function PATCH(req: Request) {
  const b = (await req.json()) as { ws?: string; agentId: string; runtimeId: string };
  try {
    const ws = await workspace(b.ws ?? null);
    const dir = await loadDirectory(ws.id);
    if (!dir.agents.some(a => a.id === b.agentId)) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
    const rt = dir.runtimes.find(r => r.id === b.runtimeId);
    if (!rt) return NextResponse.json({ error: "AI engine not found." }, { status: 404 });
    const mine = await me();
    if (rt.visibility === "private" && rt.owner_id !== mine.id) {
      const owner = dir.members.find(m => m.user_id === rt.owner_id)?.name.split(/\s+/)[0];
      return NextResponse.json({ error: `${rt.name} is a private engine on ${owner ? owner + "'s" : "someone else's"} laptop. Only its owner can move agents onto it.` }, { status: 403 });
    }
    await updateAgent(ws.id, b.agentId, { runtime_id: rt.id });
    return NextResponse.json({ ok: true, message: `Switched to ${rt.name}.` });
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
