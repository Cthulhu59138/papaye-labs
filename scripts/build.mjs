import { mkdir, cp, readFile, writeFile } from "node:fs/promises";
const projects = JSON.parse(await readFile("projects.json", "utf8"));
const escape = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
if (!Array.isArray(projects) || !projects.length) throw new Error("Le catalogue doit contenir un projet.");
const ids = new Set();
for (const project of projects) {
  for (const key of ["id", "name", "category", "description", "url", "source"]) if (typeof project[key] !== "string" || !project[key]) throw new Error(`Champ requis : ${key}`);
  if (ids.has(project.id)) throw new Error("Identifiant de projet dupliqué.");
  ids.add(project.id);
  for (const key of ["url", "source"]) if (new URL(project[key]).protocol !== "https:") throw new Error("Les liens doivent utiliser HTTPS.");
  if (!Array.isArray(project.tags) || project.tags.some(tag => typeof tag !== "string")) throw new Error("Les étiquettes doivent être du texte.");
}
const cards = projects.map((project, i) => `<article class="project-card">
  <div class="project-art" aria-hidden="true"><span class="project-number">PROJET ${String(i+1).padStart(2,"0")}</span><div class="demo-card"><div class="demo-top"><span>${escape(project.name.toLocaleUpperCase("fr"))}</span><span>✧</span></div><span class="demo-icon">🌿</span><strong>Rester curieux.</strong><p>Un souvenir après l’autre.</p><span class="demo-progress"></span></div><span class="mini-card">Un peu, chaque jour ✦</span></div>
  <div class="project-content"><div class="project-category"><span>${escape(project.category)}</span><span class="availability">Accès libre</span></div><h3>${escape(project.name)}</h3><p class="project-description">${escape(project.description)}</p><ul class="tags">${project.tags.map(tag=>`<li>${escape(tag)}</li>`).join("")}</ul><div class="project-actions"><a class="pill-button" href="${escape(project.url)}">Ouvrir ${escape(project.name)} <span aria-hidden="true">↗</span></a><a class="code-link" href="${escape(project.source)}">Le code source</a></div></div>
</article>`).join("\n");
const template = await readFile("public/index.html", "utf8");
if (!template.includes("<!--PROJECTS-->")) throw new Error("Emplacement du catalogue absent.");
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await writeFile("dist/index.html", template.replace("<!--PROJECTS-->", cards));
await writeFile("dist/.nojekyll", "");
console.log(`Papaye Labs: ${projects.length} projet(s), pages statiques prêtes.`);
