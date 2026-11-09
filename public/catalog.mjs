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
