const SLEEPER_ACTIVITY_SLUGS = ["trades", "players"];
const CAPTURE_TIMEOUT_MS = 14000;
const CAPTURE_POLL_MS = 900;

function getTransactionKey(transaction, index) {
  const id = String(transaction?.transaction_id || "").trim();
  if (id) return `${transaction.type || "unknown"}:${id}`;
  return [
    transaction?.type || "unknown",
    transaction?.status || "unknown",
    transaction?.created || "",
    transaction?.status_updated || "",
    index
  ].join(":");
}

function mergeCaptures(captures) {
  const validCaptures = captures
    .filter((capture) => capture?.leagueId && Array.isArray(capture.transactions))
    .sort((left, right) => Number(right.capturedAt || 0) - Number(left.capturedAt || 0));
  if (validCaptures.length === 0) return null;

  const leagueId = validCaptures[0].leagueId;
  const byKey = new Map();
  validCaptures
    .filter((capture) => capture.leagueId === leagueId)
    .sort((left, right) => Number(left.capturedAt || 0) - Number(right.capturedAt || 0))
    .forEach((capture) => {
      capture.transactions.forEach((transaction, index) => {
        byKey.set(getTransactionKey(transaction, index), transaction);
      });
    });

  return {
    source: "chrome-extension",
    leagueId,
    capturedAt: Date.now(),
    transactions: Array.from(byKey.values())
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    }, 4500);
  });
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      resolve(response);
    });
  });
}

async function sendAppStatus(tabId, status, detail) {
  if (!tabId) return;
  await sendMessageToTab(tabId, {
    type: "DYNASTY_DEGENS_SLEEPER_HELPER_STATUS",
    payload: { status, detail }
  });
}

async function sendSnapshotToAppTab(tabId, snapshot) {
  if (!tabId) throw new Error("Missing app tab.");
  await sendMessageToTab(tabId, {
    type: "DYNASTY_DEGENS_IMPORT_CAPTURED_SLEEPER_SNAPSHOT",
    payload: snapshot
  });
  await chrome.tabs.update(tabId, { active: true });
}

async function getStoredCapture(leagueId) {
  const result = await chrome.storage.session.get(`capture:${leagueId}`);
  return result?.[`capture:${leagueId}`] || null;
}

async function storeCapture(capture) {
  if (!capture?.leagueId) return;
  const existing = await getStoredCapture(capture.leagueId);
  const merged = mergeCaptures([existing, capture].filter(Boolean));
  if (!merged) return;
  await chrome.storage.session.set({ [`capture:${merged.leagueId}`]: merged });
}

async function ensureSleeperTab(leagueId, slug) {
  const targetUrl = `https://sleeper.com/leagues/${encodeURIComponent(leagueId)}/${slug}`;
  const matches = await chrome.tabs.query({
    url: `https://sleeper.com/leagues/${leagueId}/${slug}*`
  });
  const tab = matches.find((candidate) => candidate.id);

  if (tab?.id) {
    await chrome.tabs.update(tab.id, { url: targetUrl, active: false });
    await waitForTabComplete(tab.id);
    await chrome.tabs.reload(tab.id);
    await waitForTabComplete(tab.id);
    return tab.id;
  }

  const created = await chrome.tabs.create({ url: targetUrl, active: false });
  if (created.id) await waitForTabComplete(created.id);
  return created.id || null;
}

async function getCaptureFromSleeperTabs(leagueId) {
  const tabGroups = await Promise.all(
    SLEEPER_ACTIVITY_SLUGS.map((slug) =>
      chrome.tabs.query({ url: `https://sleeper.com/leagues/${leagueId}/${slug}*` })
    )
  );
  const captures = [];

  await Promise.all(tabGroups.flat().map(async (tab) => {
    if (!tab.id) return;
    const response = await sendMessageToTab(tab.id, { type: "GET_LATEST_SLEEPER_CAPTURE" });
    if (response?.ok && response.payload) captures.push(response.payload);
  }));

  const stored = await getStoredCapture(leagueId);
  if (stored) captures.push(stored);
  return mergeCaptures(captures.filter(Boolean));
}

async function runSleeperImportFlow({ leagueId, appTabId }) {
  await sendAppStatus(appTabId, "capturing", "Opening Sleeper Trades and Waivers...");

  await Promise.all(SLEEPER_ACTIVITY_SLUGS.map((slug) => ensureSleeperTab(leagueId, slug)));
  await sendAppStatus(appTabId, "capturing", "Refreshing Sleeper and waiting for pending transactions...");

  const start = Date.now();
  let latestCapture = null;

  while (Date.now() - start < CAPTURE_TIMEOUT_MS) {
    latestCapture = await getCaptureFromSleeperTabs(leagueId);
    if (latestCapture) break;
    await sleep(CAPTURE_POLL_MS);
  }

  if (!latestCapture) {
    latestCapture = {
      source: "chrome-extension",
      leagueId,
      capturedAt: Date.now(),
      transactions: []
    };
  }

  await sendAppStatus(appTabId, "captured", "Captured Sleeper snapshot. Importing into Dynasty Degens...");
  await sendSnapshotToAppTab(appTabId, latestCapture);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "SLEEPER_CAPTURE_UPDATED") {
    storeCapture(message.payload).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === "START_SLEEPER_CAPTURE_IMPORT") {
    const leagueId = String(message.leagueId || "").trim();
    const appTabId = sender?.tab?.id || null;
    if (!leagueId || !appTabId) {
      sendResponse({ ok: false, error: "Missing league or app tab." });
      return true;
    }

    runSleeperImportFlow({ leagueId, appTabId })
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        const detail = error instanceof Error
          ? error.message
          : "Could not capture Sleeper transactions.";
        sendAppStatus(appTabId, "error", detail).catch(() => {});
        sendResponse({ ok: false, error: detail });
      });
    return true;
  }

  return false;
});
