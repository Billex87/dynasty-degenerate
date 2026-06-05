const DEFAULT_APP_ORIGIN = "https://dynastydegens.com";
const APP_ORIGINS = [
  "https://dynastydegens.com",
  "https://www.dynastydegens.com",
  "http://localhost:3000"
];
const APP_URL_PATTERNS = APP_ORIGINS.map((origin) => `${origin}/*`);
const SLEEPER_ACTIVITY_URL_PATTERNS = [
  "https://sleeper.com/leagues/*/trades*",
  "https://sleeper.com/leagues/*/players*",
  "https://sleeper.com/leagues/*/waivers*",
  "https://sleeper.com/leagues/*/transactions*"
];

const statusEl = document.getElementById("status");
const detailEl = document.getElementById("detail");
const messageEl = document.getElementById("message");
const sendButton = document.getElementById("send");
const openButton = document.getElementById("open");
let latestSnapshot = null;

function summarize(snapshot) {
  const transactions = Array.isArray(snapshot?.transactions) ? snapshot.transactions : [];
  const tradeCount = transactions.filter((transaction) => transaction.type === "trade").length;
  const waiverCount = transactions.filter((transaction) => transaction.type === "waiver").length;
  return { tradeCount, waiverCount, total: transactions.length };
}

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
    ...validCaptures[0],
    transactions: Array.from(byKey.values())
  };
}

function setMessage(text, tone = "") {
  messageEl.textContent = text;
  messageEl.className = tone;
}

function render(snapshot) {
  latestSnapshot = snapshot || null;
  const summary = summarize(latestSnapshot);
  sendButton.disabled = !latestSnapshot;

  if (!latestSnapshot) {
    statusEl.textContent = "Listening for Sleeper activity.";
    detailEl.textContent = "Use Import Pending Transactions in Dynasty Degens for the one-click flow.";
    return;
  }

  statusEl.textContent = summary.total > 0
    ? `Captured ${summary.tradeCount} trade item${summary.tradeCount === 1 ? "" : "s"} and ${summary.waiverCount} waiver item${summary.waiverCount === 1 ? "" : "s"}.`
    : "Captured Sleeper activity, but no current pending items were visible.";
  detailEl.textContent = `League ${latestSnapshot.leagueId} · ${new Date(latestSnapshot.capturedAt).toLocaleString()}`;
}

async function loadLatestCapture() {
  const tabGroups = await Promise.all(
    SLEEPER_ACTIVITY_URL_PATTERNS.map((url) => chrome.tabs.query({ url }))
  );
  const tabs = tabGroups.flat();
  const captures = [];

  await Promise.all(tabs.map(async (tab) => {
    if (!tab.id) return;
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { type: "GET_LATEST_SLEEPER_CAPTURE" });
      if (response?.ok && response.payload) captures.push(response.payload);
    } catch {
      // Ignore Sleeper tabs that have not loaded the helper content script yet.
    }
  }));

  render(mergeCaptures(captures));
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
    }, 3000);
  });
}

async function getOrOpenAppTab(snapshot) {
  const tabGroups = await Promise.all(
    APP_URL_PATTERNS.map((url) => chrome.tabs.query({ url }))
  );
  const tabs = tabGroups.flat();
  const existingTab = tabs.find((tab) => tab.id && tab.url);
  const appOrigin = existingTab?.url
    ? new URL(existingTab.url).origin
    : DEFAULT_APP_ORIGIN;
  const appUrl = `${appOrigin}/?leagueId=${encodeURIComponent(snapshot.leagueId)}#trades`;

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { url: appUrl });
    await waitForTabComplete(existingTab.id);
    return existingTab.id;
  }

  const tab = await chrome.tabs.create({ url: appUrl, active: false });
  if (tab.id) await waitForTabComplete(tab.id);
  return tab.id;
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(error);
        return;
      }
      resolve(response);
    });
  });
}

async function sendSnapshotToApp(snapshot) {
  const tabId = await getOrOpenAppTab(snapshot);
  if (!tabId) throw new Error("Unable to open app tab.");

  const message = {
    type: "DYNASTY_DEGENS_IMPORT_CAPTURED_SLEEPER_SNAPSHOT",
    payload: snapshot,
  };

  try {
    await sendMessageToTab(tabId, message);
  } catch {
    await chrome.tabs.reload(tabId);
    await waitForTabComplete(tabId);
    await sendMessageToTab(tabId, message);
  }

  await chrome.tabs.update(tabId, { active: true });
}

sendButton.addEventListener("click", async () => {
  if (!latestSnapshot) return;
  sendButton.disabled = true;
  setMessage("Sending captured snapshot...");
  try {
    await sendSnapshotToApp(latestSnapshot);
    setMessage("Sent snapshot to Dynasty Degens.");
  } catch (error) {
    setMessage("Could not reach Dynasty Degens. Open the app, reload the extension, and try again.", "error");
  } finally {
    sendButton.disabled = !latestSnapshot;
  }
});

openButton.addEventListener("click", async () => {
  const leagueId = latestSnapshot?.leagueId || "";
  const url = leagueId
    ? `${DEFAULT_APP_ORIGIN}/?leagueId=${encodeURIComponent(leagueId)}#trades`
    : DEFAULT_APP_ORIGIN;
  await chrome.tabs.create({ url, active: true });
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "SLEEPER_CAPTURE_UPDATED") {
    render(message.payload || null);
    setMessage("Captured fresh Sleeper activity.");
  }
});

loadLatestCapture().catch(() => {
  statusEl.textContent = "Listening for Sleeper activity.";
  detailEl.textContent = "Use Import Pending Transactions in Dynasty Degens for the one-click flow.";
  sendButton.disabled = true;
});
