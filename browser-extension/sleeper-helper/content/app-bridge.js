(() => {
  const APP_SOURCE = "dynasty-degens-app";
  const EXTENSION_SOURCE = "dynasty-degens-sleeper-helper";

  function postStatus(payload) {
    window.postMessage({
      source: EXTENSION_SOURCE,
      type: "DYNASTY_DEGENS_SLEEPER_HELPER_STATUS",
      payload
    }, window.location.origin);
  }

  function getRuntime() {
    try {
      if (typeof chrome === "undefined" || !chrome.runtime?.id) return null;
      return chrome.runtime;
    } catch {
      return null;
    }
  }

  function getRuntimeErrorMessage(error) {
    const message = String(error?.message || error || "");
    if (/context invalidated|extension context/i.test(message)) {
      return "Transaction Sync was reloaded. Refresh this Dynasty Degens tab, then click Import Pending Transactions again.";
    }
    return "Could not reach the Transaction Sync extension.";
  }

  function postRuntimeError(error) {
    postStatus({
      status: "error",
      detail: getRuntimeErrorMessage(error)
    });
  }

  function postReady() {
    window.postMessage({
      source: EXTENSION_SOURCE,
      type: "DYNASTY_DEGENS_SLEEPER_HELPER_READY"
    }, window.location.origin);
  }

  function startSleeperImport(leagueId) {
    const runtime = getRuntime();
    if (!runtime?.sendMessage) {
      postRuntimeError(new Error("Extension context invalidated."));
      return;
    }

    try {
      runtime.sendMessage({
        type: "START_SLEEPER_CAPTURE_IMPORT",
        leagueId
      }, (response) => {
        let lastError = null;
        try {
          lastError = runtime.lastError;
        } catch (error) {
          postRuntimeError(error);
          return;
        }

        if (lastError) {
          postRuntimeError(lastError);
          return;
        }

        if (response?.ok) return;
        postStatus({
          status: "error",
          detail: response?.error || "Could not start the Transaction Sync import."
        });
      });
    } catch (error) {
      postRuntimeError(error);
    }
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
      startSleeperImport(message.payload?.leagueId || "");
    }
  });

  const runtime = getRuntime();
  runtime?.onMessage?.addListener((message, _sender, sendResponse) => {
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
