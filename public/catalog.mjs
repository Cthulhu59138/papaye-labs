// Shared by the static build, browser enhancement and focused tests.
export const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export function httpsUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function validateProjects(projects) {
  if (!Array.isArray(projects) || !projects.length) throw new Error("Le catalogue doit contenir un projet.");
  const ids = new Set();
  for (const project of projects) {
    for (const key of ["id", "name", "category", "description", "url"]) {
      if (typeof project?.[key] !== "string" || !project[key].trim()) throw new Error(`Champ requis : ${key}`);
    }
    if (!/^[a-z0-9-]+$/.test(project.id) || ids.has(project.id)) throw new Error("Identifiant de projet invalide ou dupliqué.");
    ids.add(project.id);
    for (const key of ["url", "source"]) if (project[key] !== undefined && !httpsUrl(project[key])) throw new Error("Les liens doivent utiliser HTTPS sans identifiants.");
    for (const key of ["ctaLabel", "status", "shortName"]) if (project[key] !== undefined && (typeof project[key] !== "string" || !project[key].trim())) throw new Error(`Champ invalide : ${key}`);
    if (project.shortName && project.shortName.length > 3) throw new Error("Le nom court est limité à trois caractères.");
    if (!Array.isArray(project.tags) || project.tags.some(tag => typeof tag !== "string")) throw new Error("Les étiquettes doivent être du texte.");
  }
  return projects;
}

export function renderCards(projects) {
  validateProjects(projects);
  return projects.map(project => `<article class="project-card" aria-labelledby="title-${escape(project.id)}">
  <span class="app-icon" aria-hidden="true">${escape(project.shortName ?? project.name.slice(0, 2).toLocaleUpperCase("fr"))}</span>
  <div class="project-content"><p class="project-category">${escape(project.category)}</p><div class="project-title"><h3 id="title-${escape(project.id)}">${escape(project.name)}</h3>${project.status ? `<span class="availability">${escape(project.status)}</span>` : ""}</div><p class="project-description">${escape(project.description)}</p><ul class="tags">${project.tags.map(tag => `<li>${escape(tag)}</li>`).join("")}</ul></div>
  <div class="project-actions"><a class="pill-button" href="${escape(project.url)}">${escape(project.ctaLabel ?? `Ouvrir ${project.name}`)} <span aria-hidden="true">↗</span></a>${project.source ? `<a class="code-link" href="${escape(project.source)}" aria-label="Code source de ${escape(project.name)}">Code source</a>` : ""}</div>
</article>`).join("\n");
}

export function validateConfig(config) {
  if (!config || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(config.owner)) throw new Error("Compte GitHub invalide.");
  if (!Array.isArray(config.exclude) || config.exclude.some(name => typeof name !== "string")) throw new Error("Exclusions invalides.");
  return config;
}

export function projectsFromRepositories(repositories, config) {
  validateConfig(config);
  if (!Array.isArray(repositories)) throw new Error("Réponse GitHub invalide.");
  const excluded = new Set(config.exclude.map(name => name.toLowerCase()));
  const projects = [];
  for (const repo of repositories) {
    if (!repo || repo.private !== false || repo.visibility === "private" || repo.archived || repo.disabled || repo.fork) continue;
    if (repo.owner?.login?.toLowerCase() !== config.owner.toLowerCase()) continue;
    if (typeof repo.name !== "string" || !/^[a-z\d._-]+$/i.test(repo.name) || excluded.has(repo.name.toLowerCase())) continue;
    if (Array.isArray(repo.topics) && repo.topics.includes("papaye-hidden")) continue;
    let url = httpsUrl(repo.homepage);
    // A repository URL is not an application launch URL.
    if (url && new URL(url).hostname.toLowerCase() === "github.com") url = null;
    if (!url && repo.has_pages === true) {
      const root = `${config.owner.toLowerCase()}.github.io`;
      url = `https://${root}/${repo.name.toLowerCase() === root ? "" : `${encodeURIComponent(repo.name)}/`}`;
    }
    if (!url) continue;
    const name = repo.name.replace(/[-_]+/g, " ");
    projects.push({
      id: `github-${repo.name.toLowerCase().replace(/[^a-z\d-]/g, "-")}`,
      name: name.charAt(0).toLocaleUpperCase("fr") + name.slice(1),
      category: "APPLICATION WEB",
      description: typeof repo.description === "string" && repo.description.trim() ? repo.description.slice(0, 300) : "Ouvrez le site de ce projet.",
      status: "Site web",
      url,
      source: `https://github.com/${config.owner}/${repo.name}`,
      tags: repo.has_pages ? ["GitHub Pages"] : ["Projet GitHub"],
    });
  }
  return projects.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

const normalizedUrl = value => value ? value.toLowerCase().replace(/\.git\/?$/, "").replace(/\/$/, "") : "";
export function mergeProjects(pinned, discovered) {
  validateProjects(pinned);
  const merged = [...pinned];
  for (const project of discovered) {
    validateProjects([project]);
    if (merged.some(item => item.id === project.id || normalizedUrl(item.url) === normalizedUrl(project.url) || (item.source && normalizedUrl(item.source) === normalizedUrl(project.source)))) continue;
    merged.push(project);
  }
  return merged;
}

export async function fetchGitHubProjects(config, fetcher = globalThis.fetch) {
  validateConfig(config);
  const repos = [];
  // Fetch every page. A failed or truncated inventory must not replace the cache.
  for (let page = 1; page <= 20; page++) {
    const response = await fetcher(`https://api.github.com/users/${encodeURIComponent(config.owner)}/repos?type=owner&sort=full_name&direction=asc&per_page=100&page=${page}`, {
      credentials: "omit", referrerPolicy: "no-referrer", headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`GitHub : HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("Réponse GitHub invalide.");
    repos.push(...batch);
    if (batch.length < 100) return projectsFromRepositories(repos, config);
  }
  throw new Error("Catalogue GitHub trop volumineux.");
}

export const CACHE_TTL = 15 * 60 * 1000;
export function readCache(storage, key, signature, now = Date.now()) {
  try {
    const cache = JSON.parse(storage?.getItem(key));
    if (!cache || cache.signature !== signature || !Array.isArray(cache.projects) || !Number.isFinite(cache.time) || cache.time > now || now - cache.time > 7 * 24 * 60 * 60 * 1000) return null;
    if (cache.projects.length) validateProjects(cache.projects);
    return { ...cache, fresh: now - cache.time < CACHE_TTL };
  } catch { return null; }
}

export function writeCache(storage, key, signature, projects, time = Date.now()) {
  try { storage?.setItem(key, JSON.stringify({ signature, projects, time })); } catch { /* Storage is optional. */ }
}
