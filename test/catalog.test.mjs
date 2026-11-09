import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { projectsFromRepositories, mergeProjects, fetchGitHubProjects, renderCards, validateProjects, readCache, writeCache, CACHE_TTL } from "../public/catalog.mjs";

const config = { owner: "Cthulhu59138", exclude: ["papaye-labs"] };
const repo = overrides => ({ name: "nouvel-outil", private: false, visibility: "public", owner: { login: config.owner }, has_pages: true, ...overrides });
const pinned = JSON.parse(await readFile(new URL("../projects.json", import.meta.url), "utf8"));

test("un nouveau site GitHub Pages est ajouté sans modifier le catalogue permanent", () => {
  const discovered = projectsFromRepositories([repo({})], config);
  const result = mergeProjects(pinned, discovered);
  assert.equal(result.length, pinned.length + 1);
  assert.equal(result.at(-1).url, "https://cthulhu59138.github.io/nouvel-outil/");
  assert.equal(result.at(-1).source, "https://github.com/Cthulhu59138/nouvel-outil");
  assert.equal(pinned.length, 2);
  assert.ok(result.find(p => p.id === "scoubi-club" && p.status === "Accès privé"));
});

test("les dépôts privés, non publiés, archivés, forks, exclus et étrangers restent absents", () => {
  const excluded = [
    repo({ private: true }), repo({ visibility: "private" }), repo({ archived: true }), repo({ disabled: true }), repo({ fork: true }),
    repo({ name: "papaye-labs" }), repo({ topics: ["papaye-hidden"] }), repo({ owner: { login: "someone-else" } }),
    repo({ has_pages: false }), repo({ has_pages: false, homepage: "javascript:alert(1)" }), repo({ has_pages: false, homepage: "https://github.com/example/repo" }),
    repo({ has_pages: false, homepage: "https://user:password@example.com/" }), repo({ private: undefined }),
  ];
  assert.deepEqual(projectsFromRepositories(excluded, config), []);
});

test("adresse Website prioritaire, pages de compte et dédoublonnage de MémoQuest", () => {
  const discovered = projectsFromRepositories([
    repo({ name: "memoquest", homepage: "https://other.example/" }),
    repo({ name: "cthulhu59138.github.io" }),
    repo({ name: "outil-externe", has_pages: false, homepage: "https://outil.example/" }),
  ], config);
  const merged = mergeProjects(pinned, discovered);
  assert.equal(merged.filter(p => p.source?.toLowerCase().endsWith("/memoquest")).length, 1);
  assert.equal(merged[0].name, "MémoQuest");
  assert.ok(discovered.some(p => p.url === "https://cthulhu59138.github.io/"));
  assert.ok(discovered.some(p => p.url === "https://outil.example/"));
});

test("contenu externe échappé et liens non HTTPS refusés avant rendu", () => {
  const unsafe = { ...pinned[0], name: '<img src=x onerror="alert(1)">', description: "</script><script>alert(1)</script>" };
  const html = renderCards([unsafe]);
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("</script>"));
  assert.match(html, /&lt;img/);
  assert.throws(() => renderCards([{ ...unsafe, url: "javascript:alert(1)" }]));
  assert.throws(() => validateProjects([pinned[0], pinned[0]]));
});

test("pagination complète et requêtes sans authentification", async () => {
  const calls = [];
  const result = await fetchGitHubProjects(config, async (url, options) => {
    calls.push({ url, options });
    const batch = calls.length === 1 ? Array.from({ length: 100 }, (_, i) => repo({ name: `outil-${i}` })) : [repo({ name: "dernier" })];
    return { ok: true, json: async () => batch };
  });
  assert.equal(result.length, 101);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].url.endsWith("page=2"));
  assert.equal(calls[0].options.credentials, "omit");
  assert.equal(calls[0].options.headers.Authorization, undefined);
});

test("échec GitHub ou réponse invalide signalés sans catalogue partiel", async () => {
  await assert.rejects(fetchGitHubProjects(config, async () => ({ ok: false, status: 403 })), /403/);
  await assert.rejects(fetchGitHubProjects(config, async () => ({ ok: true, json: async () => ({ error: "invalid" }) })), /invalide/);
  let calls = 0;
  await assert.rejects(fetchGitHubProjects(config, async () => ++calls === 1 ? { ok: true, json: async () => Array(100).fill(repo({})) } : { ok: false, status: 500 }), /500/);
});

test("cache frais, périmé, invalide ou stockage indisponible", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeCache(storage, "test", "signature", pinned, 1000);
  assert.equal(readCache(storage, "test", "signature", 1001).fresh, true);
  assert.equal(readCache(storage, "test", "signature", 1000 + CACHE_TTL).fresh, false);
  assert.equal(readCache(storage, "test", "changed", 1001), null);
  assert.equal(readCache(storage, "test", "signature", 0), null);
  assert.equal(readCache(storage, "test", "signature", 1000 + 8 * 86400000), null);
  assert.equal(readCache({ getItem() { throw Error("blocked"); } }, "test", "signature"), null);
  assert.doesNotThrow(() => writeCache({ setItem() { throw Error("blocked"); } }, "test", "signature", pinned));
});
