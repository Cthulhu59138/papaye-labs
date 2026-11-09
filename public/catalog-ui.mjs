import { fetchGitHubProjects, mergeProjects, renderCards, readCache, writeCache } from "./catalog.mjs";

const { projects: pinned, github } = JSON.parse(document.getElementById("catalog-data").textContent);
const list = document.querySelector(".project-list");
const count = document.querySelector(".count");
const status = document.getElementById("catalog-status");
const refresh = document.getElementById("catalog-refresh");
const key = "papaye:catalog:v1";
const signature = JSON.stringify({ pinned, github });
let storage;
try { storage = window.localStorage; } catch { /* Private browsing may deny storage. */ }
let cache = readCache(storage, key, signature);
let busy = false;

function show(projects) {
  const merged = mergeProjects(pinned, projects);
  list.innerHTML = renderCards(merged);
  count.textContent = String(merged.length);
}

function updated(time) {
  status.textContent = `Catalogue actualisé à ${new Intl.DateTimeFormat("fr", { hour: "2-digit", minute: "2-digit" }).format(time)}`;
}

async function update(force = false) {
  if (busy) return;
  if (cache?.fresh && !force) { updated(cache.time); return; }
  busy = true;
  refresh.disabled = true;
  status.textContent = "Actualisation du catalogue…";
  try {
    const projects = await fetchGitHubProjects(github);
    show(projects);
    const time = Date.now();
    writeCache(storage, key, signature, projects, time);
    cache = { projects, time, fresh: true };
    updated(time);
  } catch {
    status.textContent = "Actualisation indisponible · liens enregistrés conservés";
  } finally {
    busy = false;
    refresh.disabled = false;
  }
}

document.querySelector(".catalog-controls").hidden = false;
if (cache) show(cache.projects);
refresh.addEventListener("click", () => update(true));
update();
