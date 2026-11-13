# Virtual Office

A playful, pixel-style office for your [Multica](https://multica.ai) workspace. You see your people and AI agents sitting at desks, project rooms, what needs your attention, and a task board, all in one place.

## What it is (and isn't)

**Virtual Office is a different window onto Multica, not a separate app with its own data.**

- Everything you see comes live from your Multica workspace: members, agents, projects, issues, comments, runtimes and notifications.
- Everything you do is written straight back to Multica: creating a task, approving work, replying to an agent, inviting someone or creating a project. Open Multica next to it and you'll see the same changes there.
- There is no database and no account to create. If you stop using Virtual Office, your workspace is exactly as it was in Multica.

Virtual Office only adds a few small conventions, all stored inside your Multica workspace as well:

| Feature | How it's stored in Multica |
|---|---|
| **Office open / closed** (pauses or resumes agent work) | workspace settings |
| **Who's in the office** | a hidden issue called `🟢 Virtual Office · who's in` |
| **Person-to-person chat** | one hidden issue per pair, titled `💬 Chat · A & B` |
| **Agent summaries and questions** | a short report-format section added to agent instructions |

Leave those hidden issues in the backlog and don't delete them. Virtual Office filters them out of its own views.

## What you need

- **A Multica account** with at least one workspace, on either:
  - **multica.ai** (the hosted service), or
  - **a self-hosted Multica server**, e.g. `multica.playdev.online`.
- **Node.js 20 or newer (LTS)** from [nodejs.org](https://nodejs.org). Works on macOS and Windows.
- **One way to sign in**, either of these:
  - **Multica Desktop** installed and signed in on the same computer (easiest), or
  - **a personal access token** from Multica (Multica web app → Settings → Tokens; it starts with `mul_`).
- **Optional:** Git, so the app can update itself.

Virtual Office runs **on your own computer** (`http://127.0.0.1:3456`). It is not hosted anywhere, and your login never leaves your machine.

## Quick start

### 1. Get the code

With Git:

```bash
git clone https://github.com/sarahshafiran/kantor-virtual.git
cd kantor-virtual
```

Or download the ZIP from GitHub (**Code → Download ZIP**), unzip it, and open a terminal in that folder.

### 2. Create your settings file

macOS / Linux:

```bash
cp .env.example .env.local
```

Windows (Command Prompt):

```bat
copy .env.example .env.local
```

Open `.env.local` in any text editor and pick your server:

| Server | `MULTICA_API_URL` | `MULTICA_APP_URL` |
|---|---|---|
| multica.ai | `https://api.multica.ai` | `https://multica.ai` |
| multica.playdev.online | `https://api.multica.playdev.online` | `https://multica.playdev.online` |
| your own server | your server's API address | your server's web address |

Then choose how to sign in:

- **With Multica Desktop:** leave `MULTICA_TOKEN` empty. The app uses the Multica Desktop login on this computer whose server matches `MULTICA_API_URL`. Make sure Multica Desktop is signed in to that server.
- **With a token:** paste your personal access token after `MULTICA_TOKEN=`. Treat it like a password: it has full access to your Multica account. Never commit `.env.local` or share it (Git already ignores it).

### 3. Start it

**The easy way:** double-click the launcher in the folder.

- **macOS:** `Buka Kantor.command`
  - If you downloaded the ZIP, first run `chmod +x "Buka Kantor.command"` once.
  - The first time, right-click → **Open** to get past the macOS security prompt.
- **Windows:** `Buka Kantor.cmd`

The launcher installs everything on first run (1–2 minutes), updates from GitHub if you used Git, then opens your browser. Keep its window open while you use the office, and close it to stop.

**The developer way:**

```bash
npm install
```

```bash
npm run dev
```

Then open http://127.0.0.1:3456.

### 4. Look around

- **Switch workspace:** use the switcher at the top of the sidebar (or set `MULTICA_WORKSPACE_ID` in `.env.local`).
- **New workspace or project:** use **＋ New workspace** in the switcher, or **＋ New project** on the Office or Task Board.

## What's inside

| Page | What it shows |
|---|---|
| **Office** | Team desks (people and agents), a room per project, the lounge, and **Needs attention**: late or at-risk tasks, to-dos for people, work to review, and failures. |
| **Task Board** | A kanban per project: Backlog → Ready → In progress → Needs review → Done. |
| **Team Members** | People and AI agents, their projects and workload. Invite someone by email, create an agent, or pick each agent's AI engine. |
| **Messages** | Chat between people in the workspace. |
| **Notifications** | Your Multica inbox: mentions, reviews and updates. |
| **Task pop-up** | The agent's output on the left. On the right: a short summary, the agent's questions as answer cards, and approve / request changes. Type `@` to mention someone. |
| **Ask Mika** (or your own manager) | A floating chat with your office-manager agent. |

## Optional settings (`.env.local`)

| Setting | What it does |
|---|---|
| `NEXT_PUBLIC_KANTOR_MANAGER` | Name of the agent behind the floating "Ask …" chat. Default is `Mika`. Use the exact name of an agent in your workspace. |
| `KANTOR_TIMEZONE` | Time zone for "today", due dates and late tasks. Default is `Asia/Jakarta`. |
| `MULTICA_WORKSPACE_ID` | Workspace to open first. Default is the first one. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHATS`, `TELEGRAM_BOTS` | Telegram reminders. See `setup/SETUP-TELEGRAM.md`. |

### Better agent summaries

The task pop-up works best when agents end their replies with a `## Summary` and `## Questions` section. To add that instruction to every agent in your workspace:

```bash
npm run agents:format -- --dry
```

```bash
npm run agents:format
```

The first command previews the change and the second applies it. Agents created from **Team Members** get it automatically.

## Who shows as "in the office"

A person shows as **in the office** when either:

- they have Virtual Office open, or
- their Multica Desktop or runtime is online.

Otherwise it shows when they were last seen.

## Good to know

- **Agents run where their runtime runs.** In Multica, each agent is tied to one runtime, usually someone's laptop with Multica Desktop. When that laptop is off, the agent's work waits, and the office shows "Laptop off".
- **Private runtimes:** only the owner can move agents onto a private runtime. Team Members greys those out for everyone else.
- **Roles:** some actions need workspace **owner** or **admin** rights in Multica, such as opening or closing the office and inviting people. Members can still use everything else.
- **Customizing:** the look lives in `app/globals.css` and the pixel icons in `app/pixel-icon.tsx`. If you keep a personalized copy, you can update `lib/` from this repo to get fixes without touching your styling.
- **Older Multica servers:** the app works around endpoints that self-hosted servers may not have yet.

## Troubleshooting

| You see | Try |
|---|---|
| "Not signed in to Multica on this laptop" | Sign in to Multica Desktop on the server in `MULTICA_API_URL`, or set `MULTICA_TOKEN`. Then reload. |
| `401` / `403` errors | The token is for a different server, has expired, or your role doesn't allow that action. |
| The page is blank or shows a red "Runtime Error" after updating | Stop the app (Ctrl+C or close the launcher window) and start it again. |
| Port 3456 is already in use | Another copy is running. Close it, or start on another port with `npm run dev -- -p 3457`. |

## For developers

- **Stack:** Next.js 15 (App Router), React 19, TypeScript. All Multica calls happen server-side in `lib/multica.ts`. The token never reaches the browser.
- **Scripts:**
  - `npm run typecheck`: TypeScript check.
  - `npm run penjaga:uji`: dry run of the office watchdog, which resumes paused tasks and sends Telegram reminders.
- **Other files:**
  - `.github/workflows/penjaga.yml`: optional scheduled watchdog that runs on GitHub. It needs repository secrets; see `setup/SETUP-TELEGRAM.md`.
  - `data/judul.json` (optional, not committed): friendlier titles for your own issues, as `{ "issue-id": "Title" }`. See `data/judul.example.json`.

## License

MIT. See [LICENSE](LICENSE).

### Your own office character (optional, private)
Put your animation frames in `public/me/` with a `character.json` (`people`: your name(s); `frames.idle`, optional `frames.waving`: image paths; optional `scale`, `x`, `y`, `fps`).
That folder is git-ignored, so the character only shows on your own computer; everyone else keeps the default pixel person.
