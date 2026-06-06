const SLEEPER_ACTIVITY_SLUGS = ["trades", "players"];
const CAPTURE_TIMEOUT_MS = 14000;
const CAPTURE_POLL_MS = 900;
const inMemoryCaptures = new Map();

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

function getRuntimeLastError() {
  try {
    return chrome.runtime.lastError || null;
  } catch {
    return null;
  }
}

function callChromeApi(invoke) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (result) => {
      if (settled) return;
      settled = true;
      const lastError = getRuntimeLastError();
      if (lastError) {
        reject(new Error(lastError.message || String(lastError)));
        return;
      }
      resolve(result);
    };

    try {
      const maybePromise = invoke(settle);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.then(
          (result) => {
            if (!settled) {
              settled = true;
              resolve(result);
            }
          },
          (error) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          }
        );
      }
    } catch (error) {
      if (!settled) {
        settled = true;
        reject(error);
      }
    }
  });
}

function queryTabs(queryInfo) {
  return callChromeApi((done) => chrome.tabs.query(queryInfo, done))
    .then((tabs) => (Array.isArray(tabs) ? tabs : []));
}

function updateTab(tabId, updateProperties) {
  return callChromeApi((done) => chrome.tabs.update(tabId, updateProperties, done));
}

function createTab(createProperties) {
  return callChromeApi((done) => chrome.tabs.create(createProperties, done));
}

function reloadTab(tabId) {
  return callChromeApi((done) => chrome.tabs.reload(tabId, done));
}

function storageGet(storageArea, key) {
  return callChromeApi((done) => storageArea.get(key, done));
}

function storageSet(storageArea, value) {
  return callChromeApi((done) => storageArea.set(value, done));
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
  await updateTab(tabId, { active: true });
}

function getSessionStorageArea() {
  try {
    return chrome?.storage?.session || null;
  } catch {
    return null;
  }
}

async function getStoredCapture(leagueId) {
  const key = `capture:${leagueId}`;
  const storageArea = getSessionStorageArea();
  if (!storageArea) return inMemoryCaptures.get(key) || null;

  try {
    const result = await storageGet(storageArea, key);
    return result?.[key] || null;
  } catch {
    return inMemoryCaptures.get(key) || null;
  }
}

async function storeCapture(capture) {
  if (!capture?.leagueId) return;
  const existing = await getStoredCapture(capture.leagueId);
  const merged = mergeCaptures([existing, capture].filter(Boolean));
  if (!merged) return;
  const key = `capture:${merged.leagueId}`;
  const storageArea = getSessionStorageArea();
  if (!storageArea) {
    inMemoryCaptures.set(key, merged);
    return;
  }

  try {
    await storageSet(storageArea, { [key]: merged });
  } catch {
    inMemoryCaptures.set(key, merged);
  }
}

async function ensureSleeperTab(leagueId, slug) {
  const targetUrl = `https://sleeper.com/leagues/${encodeURIComponent(leagueId)}/${slug}`;
  const matches = await queryTabs({
    url: `https://sleeper.com/leagues/${leagueId}/${slug}*`
  });
  const tab = matches.find((candidate) => candidate.id);

  if (tab?.id) {
    await updateTab(tab.id, { url: targetUrl, active: false });
    await waitForTabComplete(tab.id);
    await reloadTab(tab.id);
    await waitForTabComplete(tab.id);
    return tab.id;
  }

  const created = await createTab({ url: targetUrl, active: false });
  if (created.id) await waitForTabComplete(created.id);
  return created.id || null;
}

async function getCaptureFromSleeperTabs(leagueId) {
  const tabGroups = await Promise.all(
    SLEEPER_ACTIVITY_SLUGS.map((slug) =>
      queryTabs({ url: `https://sleeper.com/leagues/${leagueId}/${slug}*` })
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
    await sendAppStatus(
      appTabId,
      "error",
      "Sleeper did not return a pending-transaction snapshot. Make sure you are signed into Sleeper, keep the opened tabs available, then try again."
    );
    return;
  }

  const pendingCount = Array.isArray(latestCapture.transactions)
    ? latestCapture.transactions.length
    : 0;
  await sendAppStatus(
    appTabId,
    "captured",
    pendingCount > 0
      ? "Captured Sleeper snapshot. Importing into Dynasty Degens..."
      : "Sleeper responded, but no pending trades or waiver claims were visible."
  );
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
