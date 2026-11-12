# Telegram reminders (optional)

Virtual Office can send Telegram messages to people in your workspace, for example:

- an AI subscription's quota ran out (with its reset time), and when paused work resumes
- new agent work is waiting for review
- a new to-do was assigned to someone (sent to that person only)
- the Claude / Codex login on a laptop expired
- a morning summary: late tasks and tasks due within 2 days

Messages come from the app while someone has Virtual Office open. If you also set up the GitHub schedule (step 5), they come even when every laptop is off. The two never send the same message twice.

Setup takes about 15 minutes. Keep every token to yourself: don't paste them into chats, issues or commits.

## 1. Create a bot

1. In Telegram, open **@BotFather** and send `/newbot`.
2. Give the bot a name (e.g. `My Office`) and a username ending in `bot` (e.g. `my_office_bot`).
3. BotFather replies with a **token** that looks like `123456789:ABC...`. Copy it.

## 2. Say hello to the bot

Everyone who should get messages opens the bot (the `t.me/...` link from BotFather) and presses **Start**.

## 3. Add it to `.env.local`

1. Paste the bot token after `TELEGRAM_BOT_TOKEN=` in `.env.local`.
2. Find everyone's chat id:

   ```bash
   npm run telegram:cek
   ```

3. Fill `TELEGRAM_CHATS` as `Name:chatId` pairs separated by commas, using each person's **name as it appears in Multica**:

   ```
   TELEGRAM_CHATS=Ara:123456,Dan:789012
   ```

4. Restart Virtual Office, then send a test message:

   ```bash
   npm run telegram:tes
   ```

**Several workspaces?** Messages from one bot carry the workspace name. To give a workspace its own bot instead, add it to `TELEGRAM_BOTS` as `workspace-slug=token`, separated by semicolons.

## 4. (Optional) A Multica token for the GitHub schedule

1. In the Multica web app, go to **Settings → Tokens** and create a token, e.g. named `Office watchdog`.
2. Copy it. It starts with `mul_` and is shown only once.

## 5. (Optional) Run the watchdog on GitHub

This needs your own copy of the repository on GitHub, i.e. a fork or your own repo.

1. Open your repository → **Settings → Secrets and variables → Actions** → **New repository secret**.
2. Add these secrets:

   | Name | Value |
   |---|---|
   | `MULTICA_TOKEN` | the Multica token from step 4 |
   | `TELEGRAM_BOT_TOKEN` | the bot token from step 1 |
   | `TELEGRAM_CHATS` | the same `Name:chatId` line from step 3 |
   | `TELEGRAM_BOTS` | optional, as in step 3 |

3. Not on multica.ai, or not in Jakarta time? Under **Variables** (same page), add `MULTICA_API_URL` and `MULTICA_APP_URL` (e.g. `https://api.multica.playdev.online` and `https://multica.playdev.online`) and/or `KANTOR_TIMEZONE`. The schedule in `.github/workflows/penjaga.yml` runs every 30 minutes from 07:00 to 23:30 Jakarta time; change the `cron` line for another time zone.
4. Open the **Actions** tab → **Penjaga kantor** → **Run workflow**. A green check within 1–2 minutes means it works.

The first run quietly records what is already going on, so you won't get a flood of old news. The first message you'll usually see is the morning summary.
