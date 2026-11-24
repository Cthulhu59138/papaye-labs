import { searchCatalogue } from "./catalogue.mjs";

const $ = (id) => document.getElementById(id);
const callButton = $("call");
const searchInput = $("query");
let sdkPromise;
let activeCall;
let callVersion = 0;
let searchVersion = 0;
let timeout;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value) node.textContent = value;
  if (className) node.className = className;
  return node;
}

function showResults(response) {
  const fragment = document.createDocumentFragment();
  for (const item of response.results) {
    const card = element("li", null, "result");
    card.append(element("h3", item.title), element("p", item.detail));
    const links = element("div", null, "result-links");
    for (const link of item.links ?? []) {
      let url;
      try { url = new URL(link.url); } catch { continue; }
      if (url.protocol !== "https:" || url.hostname !== "fnp.edf.fr") continue;
      const anchor = element("a", link.label);
      anchor.href = url.href;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      links.append(anchor);
    }
    card.append(links);
    fragment.append(card);
  }
  $("results").replaceChildren(fragment);
  const count = response.total > response.results.length ? ` (${response.results.length} affichés sur ${response.total}.)` : "";
  $("search-feedback").textContent = response.message + count;
}

async function runSearch(raw, isCurrent = () => true) {
  const query = String(raw ?? "").trim().slice(0,500);
  if (!isCurrent()) return { message:"Conversation terminée.", results:[], total:0 };
  const version = ++searchVersion;
  searchInput.value = query;
  $("search-feedback").textContent = "Recherche dans le catalogue…";
  $("results").replaceChildren();
  let result;
  try {
    result = query
      ? await searchCatalogue(query)
      : { message:"Indique un code, un numéro FNP, un produit ou un usage.", results:[], total:0 };
  } catch {
    result = { message:"Impossible de charger le catalogue. Vérifie ta connexion et réessaie.", results:[], total:0 };
  }
  if (isCurrent() && version === searchVersion) showResults(result);
  return result;
}

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  void runSearch(searchInput.value);
});
for (const button of document.querySelectorAll("[data-query]")) {
  button.addEventListener("click", () => { void runSearch(button.dataset.query); });
}

function loadSdk() {
  if (window.ElevenLabsClient?.Conversation) return Promise.resolve(window.ElevenLabsClient);
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.36.0/dist/lib.iife.js";
      script.crossOrigin = "anonymous";
      script.integrity = "sha384-J9eZZFgxK6fWeY5R/58op3XJfCDj0KNY2ZfuFXtWKyZfPbPASQdF0sS0KWw4svEC";
      const timer = setTimeout(fail, 20000);
      function fail() {
        clearTimeout(timer);
        script.onerror = null;
        script.onload = null;
        script.remove();
        sdkPromise = null;
        reject(new Error("voice-sdk-unavailable"));
      }
      script.onerror = fail;
      script.onload = () => {
        clearTimeout(timer);
        if (window.ElevenLabsClient?.Conversation) resolve(window.ElevenLabsClient);
        else fail();
      };
      document.head.append(script);
    });
  }
  return sdkPromise;
}

function setCallState(state, message) {
  document.body.dataset.call = state;
  $("call-status").textContent = message;
  $("call-label").textContent = {
    idle:"Solliciter le Peintre", connecting:"Annuler la connexion", active:"Terminer l’échange", stopping:"Fermeture…"
  }[state];
  callButton.disabled = state === "stopping";
}

function readableError(error) {
  const detail = String(error?.name ?? "") + " " + String(error?.message ?? error ?? "");
  if (/NotAllowed|PermissionDenied|permission|denied/i.test(detail)) return "Accès au micro refusé. Autorise-le dans ton navigateur ou utilise la recherche ci-dessous.";
  if (/NotFound|DevicesNotFound/i.test(detail)) return "Aucun microphone détecté. Branche un micro ou utilise la recherche ci-dessous.";
  if (/NotReadable|TrackStart/i.test(detail)) return "Le microphone est occupé. Libère-le puis réessaie.";
  return "Connexion vocale indisponible. Réessaie ou utilise la recherche ci-dessous.";
}

function addMessage({ source, message }) {
  if (!message || !["user","ai"].includes(source)) return;
  const item = element("li");
  item.append(element("strong", source === "user" ? "Toi" : "PAP"), document.createTextNode(message));
  $("messages").prepend(item);
  $("transcription").hidden = false;
}

async function closeCall(version, message) {
  if (version !== callVersion) return;
  const closed = ++callVersion;
  clearTimeout(timeout);
  const previous = activeCall;
  activeCall = null;
  if (previous) {
    setCallState("stopping", "Fermeture de la session vocale…");
    try { await previous.endSession(); } catch { /* A disconnected session can already be closed. */ }
  }
  if (closed === callVersion) setCallState("idle", message);
}

async function startCall() {
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    setCallState("idle", "Ce navigateur ne donne pas accès au micro. Utilise la recherche ci-dessous ou ouvre la page en HTTPS dans un navigateur récent.");
    return;
  }
  const version = ++callVersion;
  const current = () => version === callVersion;
  let mode = "listening";
  const reportMode = () => setCallState("active", mode === "speaking" ? "PAP te répond…" : "À toi de parler.");
  setCallState("connecting", "Connexion à ElevenLabs. Autorise le micro si ton navigateur le demande.");
  timeout = setTimeout(() => { void closeCall(version,"Le délai de connexion est dépassé. Vérifie le micro et la connexion, puis réessaie."); }, 45000);
  try {
    const [{ agentId },{ Conversation }] = await Promise.all([import("./agent.mjs"),loadSdk()]);
    if (!current()) return;
    if (!/^agent_[a-zA-Z0-9_-]+$/.test(agentId)) throw new Error("agent-unavailable");
    const call = await Conversation.startSession({
      agentId,
      connectionType:"websocket",
      clientTools:{
        rechercher_fnp: async ({ requete }) => JSON.stringify(await runSearch(requete,current))
      },
      onMessage: (data) => { if (current()) addMessage(data); },
      onModeChange: (data) => {
        mode = data.mode;
        if (current() && activeCall) reportMode();
      },
      onError: (error) => { void closeCall(version,readableError(error)); },
      onDisconnect: (detail) => {
        if (!current()) return;
        activeCall = null;
        void closeCall(version,detail?.reason === "error" ? readableError(detail.message) : "Échange terminé.");
      }
    });
    if (!current()) { await call.endSession(); return; }
    clearTimeout(timeout);
    activeCall = call;
    reportMode();
  } catch (error) {
    await closeCall(version,readableError(error));
  }
}

callButton.addEventListener("click", () => {
  if (document.body.dataset.call === "connecting") void closeCall(callVersion,"Connexion annulée.");
  else if (activeCall) void closeCall(callVersion,"Échange terminé.");
  else {
    $("messages").replaceChildren();
    $("transcription").hidden = true;
    void startCall();
  }
});
window.addEventListener("pagehide", () => { void closeCall(callVersion,"Échange terminé."); });
setCallState("idle","");
