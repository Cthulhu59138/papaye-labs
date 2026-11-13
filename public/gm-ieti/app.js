"use strict";
(() => {
  const button = document.getElementById("call-button");
  const label = document.getElementById("call-label");
  const icon = document.getElementById("call-icon");
  const status = document.getElementById("status");
  const agentId = window.GM_IETI_CONFIG?.agentId;
  let conversation = null;
  let phase = "idle";
  let generation = 0;
  let deadline;
  let sdkPromise;

  function render(state, message) {
    document.body.dataset.state = state;
    status.textContent = message;
    label.textContent = phase === "connecting" ? "Annuler" : phase === "active" ? "Laisser le GM tranquille" : "Déranger le Grand Méchant IETI";
    icon.textContent = phase === "active" ? "■" : phase === "connecting" ? "×" : "↗";
    button.disabled = phase === "stopping";
    button.setAttribute("aria-busy", String(phase === "connecting" || phase === "stopping"));
  }

  function loadSDK() {
    if (window.ElevenLabsClient?.Conversation) return Promise.resolve(window.ElevenLabsClient);
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.36.0/dist/lib.iife.js";
      script.crossOrigin = "anonymous";
      script.integrity = "sha384-J9eZZFgxK6fWeY5R/58op3XJfCDj0KNY2ZfuFXtWKyZfPbPASQdF0sS0KWw4svEC";
      const timeout = setTimeout(() => failed(), 20000);
      function failed() { clearTimeout(timeout); script.remove(); sdkPromise = null; reject(new Error("sdk-unavailable")); }
      script.onerror = failed;
      script.onload = () => { clearTimeout(timeout); window.ElevenLabsClient?.Conversation ? resolve(window.ElevenLabsClient) : failed(); };
      document.head.append(script);
    });
    return sdkPromise;
  }

  function errorMessage(error) {
    const text = `${error?.name || ""} ${error?.message || error || ""}`;
    if (/NotAllowed|PermissionDenied|permission|denied/i.test(text)) return "Le micro est bloqué. Autorise-le dans ton navigateur, puis dérange-moi à nouveau.";
    if (/NotFound|DevicesNotFound/i.test(text)) return "Je ne trouve pas de micro. Branche-le, puis réessaie.";
    if (/NotReadable|TrackStart/i.test(text)) return "Ton micro est occupé. Libère-le dans l’autre application, puis réessaie.";
    return "La liaison a coupé. Vérifie ta connexion, puis dérange-moi à nouveau.";
  }

  function finish(id, message, error = false) {
    if (id !== generation) return;
    generation++;
    clearTimeout(deadline);
    const previous = conversation;
    conversation = null;
    phase = "idle";
    render(error ? "error" : "idle", message);
    if (previous) void previous.endSession().catch(() => {});
  }

  async function toggleCall() {
    if (phase === "stopping") return;
    if (phase === "connecting") {
      finish(generation, "Bon. Je retourne à ma tranquillité. Si le navigateur demande ton micro, tu peux fermer sa demande.");
      return;
    }
    if (phase === "active") {
      const id = generation;
      const ending = conversation;
      conversation = null;
      phase = "stopping";
      render("idle", "Le GM raccroche…");
      try { await ending.endSession(); }
      catch { /* The disconnected callback may already have closed the session. */ }
      finally { finish(id, "Bon. On a avancé. Je retourne grogner."); }
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || !/^agent_[\w-]+$/.test(agentId || "")) {
      render("error", "La conversation n’est pas disponible dans ce navigateur. Essaie un navigateur récent avec un micro.");
      return;
    }
    const id = ++generation;
    phase = "connecting";
    render("connecting", "On le dérange… Autorise ton micro si le navigateur le demande.");
    deadline = setTimeout(() => finish(id, "Ça traîne. Vérifie l’autorisation du micro et ta connexion, puis réessaie.", true), 45000);
    let mode = "listening";
    try {
      const { Conversation } = await loadSDK();
      if (id !== generation) return;
      const opened = await Conversation.startSession({
        agentId,
        connectionType: "websocket",
        onModeChange: ({ mode: next }) => {
          mode = next;
          if (id === generation && phase === "active") render(mode, mode === "speaking" ? "Le GM te répond…" : "À toi. Des faits, même incomplets.");
        },
        onDisconnect: () => {
          if (id !== generation) return;
          conversation = null;
          finish(id, "Le GM a raccroché. Tu peux le déranger à nouveau.");
        },
        onError: (error) => finish(id, errorMessage(error), true)
      });
      // A cancelled or timed-out request can resolve late: close its microphone immediately.
      if (id !== generation) { await opened.endSession(); return; }
      clearTimeout(deadline);
      conversation = opened;
      phase = "active";
      render(mode, mode === "speaking" ? "Le GM te répond…" : "À toi. Des faits, même incomplets.");
    } catch (error) { finish(id, errorMessage(error), true); }
  }

  button.addEventListener("click", () => { void toggleCall(); });
  window.addEventListener("pagehide", () => finish(generation, "Conversation terminée."));
  button.disabled = false;
})();
