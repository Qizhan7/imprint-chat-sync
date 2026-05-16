const CLAUDE_API_BASE = "https://claude.ai/api";
const RECEIVER_BASE = "http://localhost:8001";
const FETCH_DELAY_MS = 500;
const DEFAULT_MAX_CONVERSATIONS_PER_SYNC = 20;

async function claudeFetch(url) {
  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (response.status === 401) {
    throw new AuthError("Session expired — please log in to claude.ai");
  }
  if (response.status === 403) {
    throw new ApiError("Access denied (403)", 403);
  }
  if (response.status === 429) {
    throw new ApiError("Rate limited (429)", 429);
  }
  if (!response.ok) {
    throw new ApiError(`HTTP ${response.status}`, response.status);
  }

  return response.json();
}

class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = "AuthError";
  }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function detectOrgId() {
  const orgs = await claudeFetch(`${CLAUDE_API_BASE}/organizations`);
  const chatOrg = orgs.find((o) => o.capabilities?.includes("chat")) || orgs[0];
  return chatOrg?.uuid || null;
}

async function fetchConversationList(orgId) {
  return claudeFetch(
    `${CLAUDE_API_BASE}/organizations/${orgId}/chat_conversations`
  );
}

async function fetchConversation(orgId, convId) {
  return claudeFetch(
    `${CLAUDE_API_BASE}/organizations/${orgId}/chat_conversations/${convId}?tree=True&rendering_mode=messages&render_all_tools=true`
  );
}

function getCurrentBranch(data) {
  if (!data.chat_messages || !data.current_leaf_message_uuid) {
    return [];
  }

  const messageMap = new Map();
  data.chat_messages.forEach((msg) => messageMap.set(msg.uuid, msg));

  const branch = [];
  let currentUuid = data.current_leaf_message_uuid;

  while (currentUuid && messageMap.has(currentUuid)) {
    const message = messageMap.get(currentUuid);
    branch.unshift(message);
    currentUuid = message.parent_message_uuid;
    if (!messageMap.has(currentUuid)) break;
  }

  return branch;
}

function formatTimestamp(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function parseMessage(message, speakers = {}) {
  // speakers: { user: string|null, agent: string|null }
  // If a name is empty/null, the speaker field is omitted entirely so the
  // receiver can fall back to its own IMPRINT_USER_NAME / IMPRINT_AGENT_NAME.
  const records = [];
  const created_at = formatTimestamp(message.created_at);

  if (!message.content || !Array.isArray(message.content)) return records;

  if (message.sender === "human") {
    const textParts = message.content
      .filter((c) => c.type === "text" && c.text)
      .map((c) => c.text);

    if (textParts.length > 0) {
      const rec = {
        direction: "in",
        content: textParts.join("\n"),
        created_at,
        uuid: message.uuid,
      };
      if (speakers.user) rec.speaker = speakers.user;
      records.push(rec);
    }
  } else if (message.sender === "assistant") {
    const parts = [];

    for (const c of message.content) {
      if (c.type === "thinking" && c.thinking) {
        parts.push(`<think>\n${c.thinking}\n</think>`);
      } else if (c.type === "text" && c.text) {
        parts.push(c.text);
      }
    }

    if (parts.length > 0) {
      const rec = {
        direction: "out",
        content: parts.join("\n\n"),
        created_at,
        uuid: message.uuid,
      };
      if (speakers.agent) rec.speaker = speakers.agent;
      records.push(rec);
    }
  }

  return records;
}

function findNewMessages(branch, lastSyncedLeafUuid) {
  if (!lastSyncedLeafUuid) return branch;

  const idx = branch.findIndex((msg) => msg.uuid === lastSyncedLeafUuid);
  if (idx === -1) return branch;

  return branch.slice(idx + 1);
}

async function ingestToReceiver(conversationId, conversationTitle, messages, model = "") {
  const payload = {
    conversation_id: conversationId,
    conversation_title: conversationTitle || "",
    model: model || "",
    messages,
  };

  const response = await fetch(`${RECEIVER_BASE}/api/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Receiver returned ${response.status}`);
  }

  return response.json();
}

async function checkReceiverHealth() {
  try {
    const response = await fetch(`${RECEIVER_BASE}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sync() {
  const log = [];
  const addLog = (msg) => {
    const ts = new Date().toLocaleTimeString();
    log.push(`[${ts}] ${msg}`);
    console.log(`[ImprintSync] ${msg}`);
  };

  try {
    const { syncEnabled = true } = await chrome.storage.local.get("syncEnabled");
    if (!syncEnabled) {
      addLog("Sync disabled, skipping");
      return { success: true, log, skipped: true };
    }

    const receiverOnline = await checkReceiverHealth();
    if (!receiverOnline) {
      addLog("Receiver offline (localhost:8001), skipping");
      return { success: false, log, error: "receiver_offline" };
    }

    const state = await chrome.storage.local.get([
      "orgId",
      "conversations",
      "syncDaysBack",
      "stats",
      "maxConversationsPerSync",
      "userSpeakerName",
      "agentSpeakerName",
    ]);
    let orgId = state.orgId;
    const convState = state.conversations || {};
    const syncDaysBack = state.syncDaysBack || 7;
    const maxConversationsPerSync =
      state.maxConversationsPerSync || DEFAULT_MAX_CONVERSATIONS_PER_SYNC;
    const speakers = {
      user: (state.userSpeakerName || "").trim() || null,
      agent: (state.agentSpeakerName || "").trim() || null,
    };
    const stats = state.stats || {
      totalMessagesSynced: 0,
      totalConversationsSynced: 0,
    };

    if (!orgId) {
      addLog("Detecting orgId...");
      orgId = await detectOrgId();
      if (!orgId) throw new Error("Could not detect orgId");
      await chrome.storage.local.set({ orgId });
      addLog(`orgId: ${orgId}`);
    }

    addLog("Fetching conversation list...");
    const allConversations = await fetchConversationList(orgId);
    addLog(`Found ${allConversations.length} conversations`);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - syncDaysBack);

    const updatedConversations = allConversations.filter((conv) => {
      const updatedAt = new Date(conv.updated_at);
      if (updatedAt < cutoffDate) return false;

      const known = convState[conv.uuid];
      if (!known) return true;
      return conv.updated_at > known.lastUpdatedAt;
    });

    addLog(
      `${updatedConversations.length} conversations have updates (within ${syncDaysBack} days)`
    );

    const toProcess = updatedConversations.slice(0, maxConversationsPerSync);
    let totalIngested = 0;
    let totalSkipped = 0;

    for (const conv of toProcess) {
      try {
        addLog(`Syncing: ${conv.name || conv.uuid.slice(0, 8)}...`);
        const fullConv = await fetchConversation(orgId, conv.uuid);
        const branch = getCurrentBranch(fullConv);

        const lastLeafUuid = convState[conv.uuid]?.lastLeafUuid || null;
        const newMessages = findNewMessages(branch, lastLeafUuid);

        if (newMessages.length === 0) {
          addLog(`  No new messages`);
          convState[conv.uuid] = {
            lastLeafUuid: fullConv.current_leaf_message_uuid,
            lastUpdatedAt: conv.updated_at,
            title: conv.name || "",
          };
          continue;
        }

        const records = [];
        for (const msg of newMessages) {
          records.push(...parseMessage(msg, speakers));
        }

        if (records.length > 0) {
          const model = fullConv.model || conv.model || "";
          const result = await ingestToReceiver(conv.uuid, conv.name, records, model);
          totalIngested += result.ingested || 0;
          totalSkipped += result.skipped || 0;
          addLog(
            `  ${result.ingested} ingested, ${result.skipped} skipped`
          );
        }

        convState[conv.uuid] = {
          lastLeafUuid: fullConv.current_leaf_message_uuid,
          lastUpdatedAt: conv.updated_at,
          title: conv.name || "",
        };

        await sleep(FETCH_DELAY_MS);
      } catch (e) {
        addLog(`  Error: ${e.message}`);
        if (e instanceof AuthError) throw e;
      }
    }

    stats.totalMessagesSynced += totalIngested;
    stats.totalConversationsSynced = Object.keys(convState).length;
    stats.lastSyncResult = "success";
    stats.lastError = null;

    await chrome.storage.local.set({
      conversations: convState,
      stats,
      lastSyncTime: new Date().toISOString(),
    });

    addLog(
      `Sync complete: ${totalIngested} new messages, ${totalSkipped} duplicates`
    );
    return { success: true, log, ingested: totalIngested, skipped: totalSkipped };
  } catch (e) {
    addLog(`Sync failed: ${e.message}`);

    if (e instanceof AuthError) {
      await chrome.storage.local.set({
        "stats.lastSyncResult": "auth_error",
        "stats.lastError": e.message,
      });

      try {
        chrome.notifications.create("imprint-auth-expired", {
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "Imprint Chat Sync",
          message: "请重新登录 claude.ai",
        });
      } catch {}
    }

    return { success: false, log, error: e.message };
  }
}

async function syncAll() {
  const original = await chrome.storage.local.get("syncDaysBack");
  await chrome.storage.local.set({ syncDaysBack: 36500 });

  try {
    return await sync();
  } finally {
    await chrome.storage.local.set({
      syncDaysBack: original.syncDaysBack || 7,
    });
  }
}

export {
  sync,
  syncAll,
  checkReceiverHealth,
  detectOrgId,
  AuthError,
  ApiError,
};
