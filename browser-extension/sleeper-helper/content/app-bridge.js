(() => {
  const APP_SOURCE = "dynasty-degens-app";
  const EXTENSION_SOURCE = "dynasty-degens-sleeper-helper";

  function postReady() {
    window.postMessage({
      source: EXTENSION_SOURCE,
      type: "DYNASTY_DEGENS_SLEEPER_HELPER_READY"
    }, window.location.origin);
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || message.source !== APP_SOURCE) return;
    if (message.type === "DYNASTY_DEGENS_REQUEST_SLEEPER_HELPER_STATUS") {
      postReady();
      return;
    }
    if (message.type === "DYNASTY_DEGENS_START_SLEEPER_IMPORT") {
      chrome.runtime.sendMessage({
        type: "START_SLEEPER_CAPTURE_IMPORT",
        leagueId: message.payload?.leagueId || ""
      }).then((response) => {
        if (response?.ok) return;
        window.postMessage({
          source: EXTENSION_SOURCE,
          type: "DYNASTY_DEGENS_SLEEPER_HELPER_STATUS",
          payload: {
            status: "error",
            detail: response?.error || "Could not start the Sleeper Helper import."
          }
        }, window.location.origin);
      }).catch(() => {
        window.postMessage({
          source: EXTENSION_SOURCE,
          type: "DYNASTY_DEGENS_SLEEPER_HELPER_STATUS",
          payload: {
            status: "error",
            detail: "Could not reach the Sleeper Helper extension."
          }
        }, window.location.origin);
      });
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "DYNASTY_DEGENS_IMPORT_CAPTURED_SLEEPER_SNAPSHOT") {
      window.postMessage({
        source: EXTENSION_SOURCE,
        type: "DYNASTY_DEGENS_SLEEPER_SNAPSHOT",
        payload: message.payload
      }, window.location.origin);
      sendResponse({ ok: true });
      return true;
    }

    if (message?.type === "DYNASTY_DEGENS_SLEEPER_HELPER_STATUS") {
      window.postMessage({
        source: EXTENSION_SOURCE,
        type: "DYNASTY_DEGENS_SLEEPER_HELPER_STATUS",
        payload: message.payload
      }, window.location.origin);
      sendResponse({ ok: true });
      return true;
    }

    return false;
  });

  postReady();
})();
