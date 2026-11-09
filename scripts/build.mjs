import { mkdir, cp, readFile, writeFile } from "node:fs/promises";
import { renderCards, validateConfig } from "../public/catalog.mjs";

const projects = JSON.parse(await readFile("projects.json", "utf8"));
const github = validateConfig(JSON.parse(await readFile("catalog.config.json", "utf8")));
const cards = renderCards(projects);
const template = await readFile("public/index.html", "utf8");
for (const marker of ["<!--PROJECTS-->", "<!--PROJECT_COUNT-->", "<!--CATALOG_DATA-->"]) {
  if (!template.includes(marker)) throw new Error(`Emplacement absent : ${marker}`);
}
// Escape '<' so descriptions cannot close the inert JSON script element.
const data = JSON.stringify({ projects, github }).replace(/</g, "\\u003c");
await mkdir("dist", { recursive: true });
await cp("public", "dist", { recursive: true });
await writeFile("dist/index.html", template.replace("<!--PROJECTS-->", () => cards).replace("<!--PROJECT_COUNT-->", String(projects.length)).replace("<!--CATALOG_DATA-->", () => data));
await writeFile("dist/.nojekyll", "");
console.log(`Papaye Labs: ${projects.length} raccourcis permanents, découverte GitHub activée.`);
