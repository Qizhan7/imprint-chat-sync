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
5. Click the extension icon → first sync should fire automatically; otherwise click **Manual sync**

## Settings

| Setting | What it does | Default |
|---------|--------------|---------|
| **Auto sync** | Toggle background polling | On |
| **Interval** | How often the background alarm fires | 30 min |
| **Max per sync** | Hard cap on conversations per run (slider 5–100) | 20 |
| **User name** | Override `speaker` field for human messages | (empty) |
| **Assistant name** | Override `speaker` field for assistant messages | (empty) |

### First-sync tip

The slider caps **how many conversations the extension pulls per run** — not how far back it looks. Keep it at the default **20** for the first sync, otherwise the initial pass can take a long time (each conversation is one Claude.ai API call plus a 500 ms delay to be polite to the server).

After your history catches up, raise the slider — or use the **Sync all history** button, which temporarily extends the look-back window to ~100 years and pulls everything.

### Speaker names (Advanced)

Leave both fields empty for normal use — the receiver will fall back to its `IMPRINT_USER_NAME` / `IMPRINT_AGENT_NAME` environment variables (defaults: `User` / `Assistant`).

Fill them in only if you want this specific channel (`claude.ai`) to use a different label than your other channels.

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
5. 点扩展图标 → 第一次同步会自动开始；如果没有就点**手动同步**

## 设置

| 设置 | 干什么 | 默认 |
|------|--------|------|
| **自动同步** | 开关后台定时同步 | 开 |
| **同步间隔** | 多久跑一次 | 30 分钟 |
| **每次最多同步** | 一次最多拉几个对话（滑杆 5–100） | 20 |
| **User 称呼** | 对话里你的名字 | （空，用服务端默认） |
| **Assistant 称呼** | 对话里 AI 的名字 | （空，用服务端默认） |

### 第一次同步建议

滑杆控制的是**每次拉几个对话**，不是拉多远。第一次保持默认 **20** 就行，不然初始同步会很慢（每个对话要调一次 Claude.ai API + 500ms 礼貌延迟）。

历史追上之后可以调大——或者点**同步全部历史**按钮，一次性把所有对话都拉回来。

### 说话人名字（进阶）

一般不用填。留空时服务端会用 `IMPRINT_USER_NAME` / `IMPRINT_AGENT_NAME` 环境变量的值（默认 `User` / `Assistant`）。

只有当你想让 claude.ai 这个渠道用不同于其他渠道的名字标签时才需要填。

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
