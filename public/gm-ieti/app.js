"use strict";
(() => {
  const button = document.getElementById("call-button");
  const label = document.getElementById("call-label");
  const icon = document.getElementById("call-icon");
  const status = document.getElementById("status");
  const dialog = document.getElementById("summon-dialog");
  const agentId = window.GM_IETI_CONFIG?.agentId;
  let conversation = null;
  let phase = "idle";
  let generation = 0;
  let deadline;
  let sdkPromise;
  let stopEntrance;

  function render(state, message) {
    document.body.dataset.state = state;
    status.textContent = message;
    label.textContent = phase === "approaching" ? "Finalement, non." : phase === "connecting" ? "Annuler" : phase === "active" ? "Laisser le GM tranquille" : "Solliciter le GM-IETI";
    icon.textContent = phase === "active" ? "■" : phase === "connecting" || phase === "approaching" ? "×" : "↗";
    button.disabled = phase === "stopping";
    button.setAttribute("aria-busy", String(phase === "connecting" || phase === "approaching" || phase === "stopping"));
  }

  function playEntrance(id) {
    // Four original synthesized footsteps, scheduled from the visitor's click.
    // No microphone or external media is needed for this short scene.
    const beats = [100, 780, 1460, 2140];
    let context;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        context = new AudioContext();
        void context.resume().catch(() => {});
        const master = context.createGain();
        master.gain.value = 0.65;
        master.connect(context.destination);
        beats.forEach((delay, index) => {
          const at = context.currentTime + delay / 1000;
          const strength = [0.07, 0.12, 0.19, 0.28][index];
          const bass = context.createOscillator();
          const envelope = context.createGain();
          bass.frequency.setValueAtTime(92 - index * 4, at);
          bass.frequency.exponentialRampToValueAtTime(38, at + 0.4);
          envelope.gain.setValueAtTime(0.001, at);
          envelope.gain.exponentialRampToValueAtTime(strength, at + 0.018);
          envelope.gain.exponentialRampToValueAtTime(0.001, at + 0.47);
          bass.connect(envelope); envelope.connect(master);
          bass.start(at); bass.stop(at + 0.5);
          const crunch = context.createBuffer(1, Math.floor(context.sampleRate * 0.22), context.sampleRate);
          const samples = crunch.getChannelData(0);
          for (let n = 0; n < samples.length; n++) samples[n] = (Math.random() * 2 - 1) * (1 - n / samples.length) ** 3;
          const noise = context.createBufferSource(); noise.buffer = crunch;
          const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = 350 + index * 180;
          const grit = context.createGain(); grit.gain.value = strength * 0.55;
          noise.connect(filter); filter.connect(grit); grit.connect(master);
          noise.start(at);
        });
      }
    } catch { /* The visual scene still works if Web Audio is unavailable. */ }
    return new Promise(resolve => {
      const timers = [];
      let settled = false;
      const close = (completed) => {
        if (settled) return;
        settled = true;
        timers.forEach(clearTimeout);
        if (context) void context.close().catch(() => {});
        delete document.body.dataset.step;
        if (stopEntrance === cancel) stopEntrance = null;
        resolve(completed);
      };
      const cancel = () => close(false);
      stopEntrance = cancel;
      beats.forEach((delay, index) => timers.push(setTimeout(() => {
        if (id === generation) document.body.dataset.step = String(index + 1);
      }, delay)));
      timers.push(setTimeout(() => close(true), 2750));
    });
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
    stopEntrance?.();
    const previous = conversation;
    conversation = null;
    phase = "idle";
    render(error ? "error" : "idle", message);
    if (previous) void previous.endSession().catch(() => {});
  }

  async function toggleCall() {
    if (phase === "stopping") return;
    if (phase === "connecting" || phase === "approaching") {
      finish(generation, phase === "approaching" ? "Il n’a rien entendu. Enfin… on espère." : "Bon. Je retourne à ma tranquillité. Si le navigateur demande ton micro, tu peux fermer sa demande.");
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
    dialog.showModal();
  }

  async function startCall() {
    if (phase !== "idle") return;
    dialog.close();
    if (!navigator.mediaDevices?.getUserMedia || !/^agent_[\w-]+$/.test(agentId || "")) {
      render("error", "La conversation n’est pas disponible dans ce navigateur. Essaie un navigateur récent avec un micro.");
      return;
    }
    const id = ++generation;
    phase = "approaching";
    render("approaching", "Trop tard. Il approche…");
    deadline = setTimeout(() => finish(id, "Ça traîne. Vérifie l’autorisation du micro et ta connexion, puis réessaie.", true), 45000);
    let mode = "listening";
    try {
      // Preload while he approaches; the agent only starts after the final footstep.
      const sdkResult = loadSDK().then(value => ({ value }), error => ({ error }));
      const completed = await playEntrance(id);
      if (!completed || id !== generation) return;
      phase = "connecting";
      render("connecting", "Le GM est là… Autorise ton micro si le navigateur le demande.");
      const result = await sdkResult;
      if (result.error) throw result.error;
      const { Conversation } = result.value;
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
  document.getElementById("summon-confirm").addEventListener("click", () => { void startCall(); });
  document.getElementById("summon-cancel").addEventListener("click", () => dialog.close());
  window.addEventListener("pagehide", () => finish(generation, "Conversation terminée."));
  button.disabled = false;
})();
