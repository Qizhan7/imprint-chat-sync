import { sync, syncAll, checkReceiverHealth } from "./sync-engine.js";

const ALARM_NAME = "imprint-chat-sync";
const DEFAULT_INTERVAL_MINUTES = 30;
const DEFAULT_MAX_CONVERSATIONS = 20;

async function ensureAlarm() {
  const { syncIntervalMinutes, syncEnabled } = await chrome.storage.local.get([
    "syncIntervalMinutes",
    "syncEnabled",
  ]);

  const interval = syncIntervalMinutes || DEFAULT_INTERVAL_MINUTES;
  const enabled = syncEnabled !== false;

  if (enabled) {
    const existing = await chrome.alarms.get(ALARM_NAME);
    if (!existing) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: interval });
      console.log(`[ImprintSync] Alarm set: every ${interval} minutes`);
    }
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  // Only set defaults for keys that don't already exist — preserves user prefs on upgrade
  const existing = await chrome.storage.local.get([
    "syncIntervalMinutes",
    "syncEnabled",
    "syncDaysBack",
    "maxConversationsPerSync",
    "userSpeakerName",
    "agentSpeakerName",
  ]);
  const defaults = {};
  if (existing.syncIntervalMinutes === undefined) defaults.syncIntervalMinutes = DEFAULT_INTERVAL_MINUTES;
  if (existing.syncEnabled === undefined) defaults.syncEnabled = true;
  if (existing.syncDaysBack === undefined) defaults.syncDaysBack = 7;
  if (existing.maxConversationsPerSync === undefined) defaults.maxConversationsPerSync = DEFAULT_MAX_CONVERSATIONS;
  if (existing.userSpeakerName === undefined) defaults.userSpeakerName = "";
  if (existing.agentSpeakerName === undefined) defaults.agentSpeakerName = "";
  if (Object.keys(defaults).length > 0) {
    await chrome.storage.local.set(defaults);
  }
  await ensureAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log("[ImprintSync] Chrome started, restoring alarm...");
  await ensureAlarm();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  console.log("[ImprintSync] Alarm triggered, starting sync...");
  await sync();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "manualSync") {
    sync().then(sendResponse);
    return true;
  }

  if (message.action === "syncAll") {
    syncAll().then(sendResponse);
    return true;
  }

  if (message.action === "getStatus") {
    (async () => {
      const data = await chrome.storage.local.get([
        "syncEnabled",
        "syncIntervalMinutes",
        "lastSyncTime",
        "orgId",
        "stats",
        "conversations",
        "maxConversationsPerSync",
        "userSpeakerName",
        "agentSpeakerName",
      ]);
      const receiverOnline = await checkReceiverHealth();
      sendResponse({ ...data, receiverOnline });
    })();
    return true;
  }

  if (message.action === "updateSettings") {
    (async () => {
      const updates = {};
      const {
        syncEnabled,
        syncIntervalMinutes,
        maxConversationsPerSync,
        userSpeakerName,
        agentSpeakerName,
      } = message;

      if (syncEnabled !== undefined) updates.syncEnabled = syncEnabled;
      if (syncIntervalMinutes !== undefined) updates.syncIntervalMinutes = syncIntervalMinutes;
      if (maxConversationsPerSync !== undefined) updates.maxConversationsPerSync = maxConversationsPerSync;
      if (userSpeakerName !== undefined) updates.userSpeakerName = userSpeakerName;
      if (agentSpeakerName !== undefined) updates.agentSpeakerName = agentSpeakerName;

      if (Object.keys(updates).length > 0) {
        await chrome.storage.local.set(updates);
      }

      // Re-arm alarm only when interval/enabled changed
      if (syncEnabled !== undefined || syncIntervalMinutes !== undefined) {
        await chrome.alarms.clear(ALARM_NAME);
        const current = await chrome.storage.local.get([
          "syncEnabled",
          "syncIntervalMinutes",
        ]);
        if (current.syncEnabled) {
          chrome.alarms.create(ALARM_NAME, {
            periodInMinutes: current.syncIntervalMinutes || DEFAULT_INTERVAL_MINUTES,
          });
        }
      }

      sendResponse({ ok: true });
    })();
    return true;
  }
});
