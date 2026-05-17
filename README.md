<p align="center">
  <strong>English</strong> | <a href="#zh">中文</a>
</p>

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
- Stops the current run on Claude.ai rate limits and retries on the next alarm
- Posts to a local receiver only — nothing leaves your machine

## Install

1. Make sure your [imprint-memory](https://github.com/Qizhan7/imprint-memory) server is running on `http://localhost:8001`
2. Clone this repo:
   ```bash
   git clone https://github.com/Qizhan7/imprint-chat-sync.git
   ```
3. Open Chrome → `chrome://extensions/` → enable **Developer mode** → click **Load unpacked** → select the cloned folder
4. Log in to [claude.ai](https://claude.ai) in the same browser (so the extension can use your session)

## First-time use

1. **Open the extension popup** (click the icon in the toolbar).
2. **Expand "Advanced settings" and fill in speaker names.** Recommended — these get written into `conversation_log.speaker` for every message and let you search by name later. If you leave them blank, the receiver falls back to whatever `IMPRINT_USER_NAME` / `IMPRINT_AGENT_NAME` is set to (default `User` / `Assistant`).
3. **Click "Sync all history".** This is the one-shot full backfill — it temporarily lifts the look-back window to ~100 years and removes the per-run cap, so every conversation in your account gets pulled. It can take a while; just let it run.
4. **Done.** Auto sync stays on in the background. From now on it runs every 30 min (configurable) and only pulls new branches in conversations you've actually used recently (default 7-day lookback, capped by **Max per sync** — 20 by default).

If you only want to grab the last few days' chats and skip the historical backfill, use **Manual sync** instead of **Sync all history**.

## Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| **Auto sync** | Toggle background polling | On |
| **Interval** | How often the background alarm fires | 30 min |
| **Max per sync** | Cap on conversations pulled per incremental run | 20 |
| **User name** (Advanced) | Sets `speaker` for human messages | (empty) |
| **Assistant name** (Advanced) | Sets `speaker` for assistant messages | (empty) |

The **Max per sync** slider only affects routine incremental syncs. The **Sync all history** button bypasses it (and the 7-day lookback) just for that one run, then restores your saved values.

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

## Troubleshooting

| Symptom | What to do |
|---------|------------|
| Receiver shows offline | Start `imprint-memory-receiver` and confirm `http://localhost:8001/api/health` returns `{ "ok": true }`. |
| Claude.ai shows not logged in | Open `https://claude.ai` in the same Chrome profile and log in again. |
| Sync says rate limited | Leave auto sync on; the next scheduled run will continue from the saved cursor. Lower **Max per sync** if it happens often. |
| You changed the receiver port | The extension currently requests only `http://localhost:8001/*` for minimal permissions, so a different port requires editing `RECEIVER_BASE` and `manifest.json`. |

## Related

- [imprint-memory](https://github.com/Qizhan7/imprint-memory) — the local memory server this extension feeds
- [claude-imprint](https://github.com/Qizhan7/claude-imprint) — the full framework around imprint-memory (hooks, prompts, scripts)

## License

MIT

---

<a id="zh"></a>

<p align="center">
  <a href="#imprint-chat-sync">English</a> | <strong>中文</strong>
</p>

# imprint-chat-sync

把你在 [claude.ai](https://claude.ai) 上的对话同步到本地的 [imprint-memory](https://github.com/Qizhan7/imprint-memory) 记忆服务器。

聊天内容（包括 thinking 思考过程）通过你自己的浏览器 session 拉取，发到本地服务器——之后 Claude 就能搜索你所有的历史对话了。

## 原理

```
claude.ai  ──[浏览器 session]──>  这个扩展  ──[POST /api/ingest]──>  imprint-memory (localhost:8001)
```

- 用的是**你自己登录的 cookie** — 不需要 API key，不存密码
- 后台定时跑（默认 30 分钟一次），也可以手动触发
- 记录每个对话同步到哪了，不会重复拉
- 遇到 Claude.ai 限流就停，下次自动继续
- 只发到本地服务器——数据不会离开你的电脑

## 安装

1. 先确保 [imprint-memory](https://github.com/Qizhan7/imprint-memory) 服务在跑（`http://localhost:8001`）
2. 克隆这个仓库：
   ```bash
   git clone https://github.com/Qizhan7/imprint-chat-sync.git
   ```
3. Chrome → `chrome://extensions/` → 打开**开发者模式** → **加载已解压的扩展程序** → 选刚克隆的文件夹
4. 在同一个浏览器里登录 [claude.ai](https://claude.ai)

## 第一次怎么用

1. **点扩展图标打开 popup**。
2. **展开「高级设置」，填上称呼。** 推荐填——这两个名字会跟着每条消息写进 `conversation_log.speaker`，以后按人名搜/区分会用到。不填的话，服务端会用 `IMPRINT_USER_NAME` / `IMPRINT_AGENT_NAME` 环境变量（默认 `User` / `Assistant`）。
3. **点「同步全部历史」**。这一次性把账号里所有对话都拉下来——按钮会临时把 7 天回溯放到 100 年、把单次条数限制取消，跑完自动恢复。可能跑挺久，让它跑就行。
4. **完事**。后台自动同步保持开着，以后每 30 分钟跑一次（可调），只抓最近有更新的对话（默认 7 天内、每次最多 20 个）。

如果你不想做全量回填，只想拉最近几天的，就用**手动同步**而不是**同步全部历史**。

## 设置

| 设置 | 干什么 | 默认 |
|------|--------|------|
| **自动同步** | 开关后台定时同步 | 开 |
| **同步间隔** | 多久跑一次 | 30 分钟 |
| **每次最多同步** | 每次增量同步最多拉几个对话 | 20 |
| **User 称呼**（进阶） | 写进每条消息的 `speaker` 字段（你的名字） | （空） |
| **Assistant 称呼**（进阶） | 写进每条消息的 `speaker` 字段（AI 的名字） | （空） |

**每次最多同步**滑杆只对日常的增量同步起作用。**同步全部历史**按钮那一次会绕过它（连同 7 天回溯一起），跑完恢复你设的值。

## 隐私

- 只和 `https://claude.ai`（读你的对话）以及 `http://localhost:8001`（你的本地服务器）通信
- 没有分析、没有遥测、没有第三方请求
- 扩展只存同步进度（游标、设置、计数器）
- 源码不到 600 行纯 JS——10 分钟就能看完

## 权限说明

| 权限 | 为什么需要 |
|------|-----------|
| `alarms` | 定时后台同步 |
| `storage` | 存设置和每个对话的同步游标 |
| `notifications` | claude.ai session 过期时通知你 |
| `host: https://claude.ai/*` | 读你的对话列表和消息 |
| `host: http://localhost:8001/*` | 发消息到本地 imprint 服务器 |

## 常见问题

| 症状 | 怎么办 |
|------|--------|
| 显示 Receiver 离线 | 启动 `imprint-memory-receiver`，确认 `http://localhost:8001/api/health` 返回 `{ "ok": true }` |
| 显示 Claude.ai 未登录 | 在同一个 Chrome profile 里打开 claude.ai 重新登录 |
| 显示被限流 | 保持自动同步开着，下次会自动继续。如果经常限流就调小每次同步数量 |
| 改了 receiver 端口 | 需要改扩展里的 `RECEIVER_BASE` 和 `manifest.json` 里的权限声明 |

## 相关项目

- [imprint-memory](https://github.com/Qizhan7/imprint-memory) — 本地记忆服务器（这个扩展往那里发数据）
- [claude-imprint](https://github.com/Qizhan7/claude-imprint) — imprint-memory 的完整框架（hooks、提示词、脚本）

## 许可证

MIT
