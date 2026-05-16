const $ = (sel) => document.querySelector(sel);

async function loadStatus() {
  const data = await chrome.runtime.sendMessage({ action: "getStatus" });

  $("#syncToggle").checked = data.syncEnabled !== false;
  $("#intervalSelect").value = String(data.syncIntervalMinutes || 30);

  const maxConv = data.maxConversationsPerSync || 20;
  $("#maxConvSlider").value = String(maxConv);
  $("#maxConvDisplay").textContent = String(maxConv);

  $("#userNameInput").value = data.userSpeakerName || "";
  $("#agentNameInput").value = data.agentSpeakerName || "";

  const dot = $("#statusDot");
  dot.className = "status-dot " + (data.receiverOnline ? "online" : "offline");

  const rs = $("#receiverStatus");
  rs.textContent = data.receiverOnline ? "在线" : "离线";
  rs.className = "value " + (data.receiverOnline ? "ok" : "error");

  const auth = $("#authStatus");
  const lastResult = data.stats?.lastSyncResult;
  if (lastResult === "auth_error") {
    auth.textContent = "未登录";
    auth.className = "value error";
  } else if (data.orgId) {
    auth.textContent = "已登录";
    auth.className = "value ok";
  } else {
    auth.textContent = "未检测";
    auth.className = "value";
  }

  if (data.lastSyncTime) {
    const d = new Date(data.lastSyncTime);
    $("#lastSync").textContent = d.toLocaleString("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const stats = data.stats || {};
  $("#convCount").textContent = stats.totalConversationsSynced || 0;
  $("#msgCount").textContent = stats.totalMessagesSynced || 0;
}

function showLog(logEntries) {
  const area = $("#logArea");
  const content = $("#logContent");
  area.style.display = "block";
  content.textContent = logEntries.join("\n");
  area.scrollTop = area.scrollHeight;
}

function setButtonsDisabled(disabled) {
  $("#syncNow").disabled = disabled;
  $("#syncAllBtn").disabled = disabled;

  if (disabled) {
    $("#statusDot").className = "status-dot syncing";
    $("#syncNow").textContent = "同步中...";
  } else {
    $("#syncNow").textContent = "手动同步";
  }
}

$("#syncNow").addEventListener("click", async () => {
  setButtonsDisabled(true);
  const result = await chrome.runtime.sendMessage({ action: "manualSync" });
  setButtonsDisabled(false);
  if (result?.log) showLog(result.log);
  await loadStatus();
});

$("#syncAllBtn").addEventListener("click", async () => {
  setButtonsDisabled(true);
  $("#syncNow").textContent = "同步全部历史中...";
  const result = await chrome.runtime.sendMessage({ action: "syncAll" });
  setButtonsDisabled(false);
  if (result?.log) showLog(result.log);
  await loadStatus();
});

$("#syncToggle").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({
    action: "updateSettings",
    syncEnabled: e.target.checked,
  });
});

$("#intervalSelect").addEventListener("change", async (e) => {
  await chrome.runtime.sendMessage({
    action: "updateSettings",
    syncIntervalMinutes: parseInt(e.target.value),
  });
});

// Max-conversations slider — live display + debounced save
let maxConvSaveTimer = null;
$("#maxConvSlider").addEventListener("input", (e) => {
  $("#maxConvDisplay").textContent = e.target.value;
  clearTimeout(maxConvSaveTimer);
  maxConvSaveTimer = setTimeout(async () => {
    await chrome.runtime.sendMessage({
      action: "updateSettings",
      maxConversationsPerSync: parseInt(e.target.value),
    });
  }, 300);
});

// Speaker-name inputs — save on blur or Enter
async function saveNames() {
  await chrome.runtime.sendMessage({
    action: "updateSettings",
    userSpeakerName: $("#userNameInput").value.trim(),
    agentSpeakerName: $("#agentNameInput").value.trim(),
  });
}

$("#userNameInput").addEventListener("change", saveNames);
$("#agentNameInput").addEventListener("change", saveNames);
$("#userNameInput").addEventListener("blur", saveNames);
$("#agentNameInput").addEventListener("blur", saveNames);

loadStatus();
