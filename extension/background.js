async function getCreds(url) {
  const { apiBase, token } = await chrome.storage.sync.get(["apiBase", "token"]);
  if (!apiBase || !token) return null;
  try {
    const res = await fetch(`${apiBase}/api/vault/suggest?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    return res.json();
  } catch (e) {
    console.warn("[PSAI bg] API fetch failed", e);
    return null;
  }
}

async function broadcastToAllFrames(tabId, payload) {
  try {
    const frames = await chrome.webNavigation.getAllFrames({ tabId });
    for (const f of frames) {
      chrome.tabs.sendMessage(tabId, { type: "PSAI_AUTOFILL", payload }, { frameId: f.frameId });
    }
  } catch (e) {
    console.warn("[PSAI bg] getAllFrames failed", e);
    chrome.tabs.sendMessage(tabId, { type: "PSAI_AUTOFILL", payload });
  }
}

async function handleTab(tabId, url) {
  const data = await getCreds(url);
  console.log("[PSAI bg] suggest result:", data);
  if (!data?.exact?.length) return;
  await broadcastToAllFrames(tabId, data);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) handleTab(tabId, tab.url);
});

chrome.webNavigation.onHistoryStateUpdated.addListener(({ tabId, url }) => {
  if (url) handleTab(tabId, url);
});
