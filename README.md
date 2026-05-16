# imprint-chat-sync

Browser extension that syncs your [claude.ai](https://claude.ai) conversations into a local [imprint-memory](https://github.com/Qizhan7/imprint-memory) server.

Every chat (including `<thinking>` blocks) is pulled from the Claude.ai API using your existing session and posted to your local memory receiver — so the assistant can search across conversations afterwards.

## How it works

```
claude.ai  ──[browser session]──>  this extension  ──[POST /api/ingest]──>  imprint-memory server (localhost:8001)
```

- Uses **your own logged-in cookies** — no API key, no credentials stored
- Runs as a periodic background alarm (default every 30 min) or on-demand
- Tracks the last-synced leaf per conversation, so only new branches get re-ingested
- Posts to a local receiver only — nothing leaves your machine

## Install

1. Make sure your [imprint-memory](https://github.com/Qizhan7/imprint-memory) server is running on `http://localhost:8001`
2. Clone this repo:
   ```bash
   git clone https://github.com/Qizhan7/imprint-chat-sync.git
   ```
3. Open Chrome → `chrome://extensions/` → enable **Developer mode** → click **Load unpacked** → select the cloned folder
4. Log in to [claude.ai](https://claude.ai) in the same browser (so the extension can use your session)
5. Click the extension icon → first sync should fire automatically; otherwise click **手动同步 / Manual sync**

## Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| **自动同步 / Auto sync** | Toggle background polling | On |
| **同步间隔 / Interval** | How often the background alarm fires | 30 min |
| **每次最多同步 / Max per sync** | Hard cap on conversations per run (slider 5–100) | 20 |
| **User 称呼** | Override `speaker` field for human messages | (empty) |
| **Assistant 称呼** | Override `speaker` field for assistant messages | (empty) |

### First-sync tip

The slider caps **how many conversations the extension pulls per run** — not how far back it looks. Keep it at the default **20** for the first sync, otherwise the initial pass can take a long time (each conversation is one Claude.ai API call plus a 500 ms delay to be polite to the server).

After your history catches up, raise the slider — or use the **同步全部历史 / Sync all history** button, which temporarily extends the look-back window to ~100 years and pulls everything.

### Speaker names (Advanced)

Leave both fields empty for normal use — the receiver will fall back to its `IMPRINT_USER_NAME` / `IMPRINT_AGENT_NAME` environment variables (defaults: `User` / `Assistant`).

Fill them in only if you want this specific channel (`claude.ai`) to use a different label than your other channels. The `platform` field in the database already records that the message came from claude.ai, so most users don't need to override.

## Privacy

- Only talks to `https://claude.ai` (read your own conversations) and `http://localhost:8001` (your local imprint server)
- No analytics, no telemetry, no third-party endpoints
- Stores nothing in the extension besides sync state (last-leaf UUIDs, settings, counters)
- Source under 600 lines of plain JS — auditable in 10 minutes

## Permissions explained

| Permission | Why |
|------------|-----|
| `alarms` | Periodic background sync |
| `storage` | Remember settings and per-conversation last-leaf cursor |
| `notifications` | Notify you when your claude.ai session expires |
| `host: https://claude.ai/*` | Read your conversation list and message history |
| `host: http://localhost:8001/*` | POST messages to your local imprint server |

## Related

- [imprint-memory](https://github.com/Qizhan7/imprint-memory) — the local memory server this extension feeds
- [claude-imprint](https://github.com/Qizhan7/claude-imprint) — the full framework around imprint-memory (hooks, prompts, scripts)

## License

MIT
