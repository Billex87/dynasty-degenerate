(() => {
  const PAGE_SOURCE = "dynasty-degens-sleeper-page-hook";
  const CAPTURE_TYPE = "SLEEPER_TRADE_CENTER_CAPTURED";
  let latestCapture = null;

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

  function mergeCapture(current, incoming) {
    if (!current || current.leagueId !== incoming.leagueId) return incoming;

    const byKey = new Map();
    [...(current.transactions || []), ...(incoming.transactions || [])].forEach((transaction, index) => {
      byKey.set(getTransactionKey(transaction, index), transaction);
    });

    return {
      ...incoming,
      capturedAt: Math.max(Number(current.capturedAt || 0), Number(incoming.capturedAt || 0), Date.now()),
      transactions: Array.from(byKey.values())
    };
  }

  function injectPageHook() {
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("content/sleeper-page-hook.js");
    script.async = false;
    script.onload = () => script.remove();
    (document.documentElement || document.head || document.body).appendChild(script);
  }

  function sendRuntimeMessage(message) {
    try {
      const maybePromise = chrome.runtime.sendMessage(message);
      if (maybePromise?.catch) maybePromise.catch(() => {});
    } catch {
      // Deliberately ignore bridge failures so Sleeper behavior is unchanged.
    }
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== PAGE_SOURCE || message.type !== CAPTURE_TYPE) return;
    const payload = message.payload;
    if (!payload || payload.source !== "chrome-extension" || !payload.leagueId || !Array.isArray(payload.transactions)) return;

    latestCapture = mergeCapture(latestCapture, payload);
    sendRuntimeMessage({ type: "SLEEPER_CAPTURE_UPDATED", payload: latestCapture });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "GET_LATEST_SLEEPER_CAPTURE") return false;
    sendResponse({ ok: true, payload: latestCapture });
    return true;
  });

  injectPageHook();
})();
