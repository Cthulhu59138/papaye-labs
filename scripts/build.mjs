import { mkdir, cp, readFile, writeFile } from "node:fs/promises";

const projects = JSON.parse(await readFile("projects.json", "utf8"));
const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
if (!Array.isArray(projects) || !projects.length) throw new Error("Le catalogue doit contenir un projet.");
const ids = new Set();
for (const project of projects) {
  for (const key of ["id", "name", "category", "description", "url"]) if (typeof project[key] !== "string" || !project[key].trim()) throw new Error(`Champ requis : ${key}`);
  if (!/^[a-z0-9-]+$/.test(project.id) || ids.has(project.id)) throw new Error("Identifiant de projet invalide ou dupliqué.");
  ids.add(project.id);
  for (const key of ["url", "source"]) if (project[key] !== undefined && (typeof project[key] !== "string" || new URL(project[key]).protocol !== "https:")) throw new Error("Les liens doivent utiliser HTTPS.");
  for (const key of ["ctaLabel", "status", "shortName"]) if (project[key] !== undefined && (typeof project[key] !== "string" || !project[key].trim())) throw new Error(`Champ invalide : ${key}`);
  if (project.shortName && project.shortName.length > 3) throw new Error("Le nom court est limité à trois caractères.");
  if (!Array.isArray(project.tags) || project.tags.some(tag => typeof tag !== "string")) throw new Error("Les étiquettes doivent être du texte.");
}
const cards = projects.map(project => `<article class="project-card" aria-labelledby="title-${escape(project.id)}">
  <span class="app-icon" aria-hidden="true">${escape(project.shortName ?? project.name.slice(0, 2).toLocaleUpperCase("fr"))}</span>
  <div class="project-content"><p class="project-category">${escape(project.category)}</p><div class="project-title"><h3 id="title-${escape(project.id)}">${escape(project.name)}</h3>${project.status ? `<span class="availability">${escape(project.status)}</span>` : ""}</div><p class="project-description">${escape(project.description)}</p><ul class="tags">${project.tags.map(tag => `<li>${escape(tag)}</li>`).join("")}</ul></div>
  <div class="project-actions"><a class="pill-button" href="${escape(project.url)}">${escape(project.ctaLabel ?? `Ouvrir ${project.name}`)} <span aria-hidden="true">↗</span></a>${project.source ? `<a class="code-link" href="${escape(project.source)}" aria-label="Code source de ${escape(project.name)}">Code source</a>` : ""}</div>
</article>`).join("\n");
const template = await readFile("public/index.html", "utf8");
for (const marker of ["<!--PROJECTS-->", "<!--PROJECT_COUNT-->"]) if (!template.includes(marker)) throw new Error(`Emplacement absent : ${marker}`);
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await writeFile("dist/index.html", template.replace("<!--PROJECTS-->", cards).replace("<!--PROJECT_COUNT-->", String(projects.length)));
await writeFile("dist/.nojekyll", "");
console.log(`Papaye Labs: ${projects.length} application(s), tableau de lancement prêt.`);
