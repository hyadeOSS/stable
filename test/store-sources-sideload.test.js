const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { STORE_CHANNELS, storeChannel, catalogVariant, buildStoreCatalog, isHomeVirtualPath, isInside, sideloadCopyFilter, sideloadLabels } = require("../lib/store-sources");

const stableApp = { id: "weather", title: "Weather", repoUrl: "https://github.com/hyadeOSS/weather.git", eula: "EULA", version: "1.0.0" };
const insiderApp = { id: "weather", title: "Weather", repoUrl: "https://github.com/hyadeOSS/weather-insiders.git", version: "1.1.0-beta" };

test("storeChannel only knows stable and insiders", () => {
  assert.deepEqual(STORE_CHANNELS, ["stable", "insiders"]);
  assert.equal(storeChannel("insiders"), "insiders");
  for (const value of ["stable", "", undefined, null, 5, "Insiders", "../x"]) assert.equal(storeChannel(value), "stable");
});

test("catalogVariant copies only known fields and drops non-string screenshots", () => {
  const variant = catalogVariant("insiders", { repoUrl: "https://github.com/a/b.git", version: 2, screenshots: ["/a.png", 7, null], evil: "x" });
  assert.deepEqual(variant, { channel: "insiders", repoUrl: "https://github.com/a/b.git", version: "2", screenshots: ["/a.png"] });
});

test("without the insider source the catalog is the stable one, one variant per app", () => {
  const [app] = buildStoreCatalog([stableApp], null);
  assert.deepEqual(app.channels, ["stable"]);
  assert.equal(app.insidersOnly, false);
  assert.equal(app.repoUrl, stableApp.repoUrl); // older clients keep the default build at top level
  assert.equal(app.variants[0].eula, "EULA");
});

test("an app in both sources gets two builds; an insider-only app is flagged", () => {
  const apps = buildStoreCatalog([stableApp], [insiderApp, { id: "labs", title: "Labs", repoUrl: "https://github.com/a/labs.git" }]);
  const weather = apps.find(a => a.id === "weather");
  assert.deepEqual(weather.channels, ["stable", "insiders"]);
  assert.equal(weather.repoUrl, stableApp.repoUrl);
  assert.equal(weather.variants[1].repoUrl, insiderApp.repoUrl);
  assert.equal(weather.variants[1].eula, undefined); // the stable license is not inherited
  const labs = apps.find(a => a.id === "labs");
  assert.equal(labs.insidersOnly, true);
  assert.deepEqual(labs.channels, ["insiders"]);
});

test("an inline insiders entry on a stable app adds a build only when the source is on", () => {
  const entry = { ...stableApp, insiders: { repoUrl: "https://github.com/a/inline.git" } };
  assert.equal(buildStoreCatalog([entry], null)[0].variants.length, 1);
  assert.equal("insiders" in buildStoreCatalog([entry], null)[0], false);
  const [app] = buildStoreCatalog([entry], []);
  assert.deepEqual(app.channels, ["stable", "insiders"]);
  assert.equal(app.variants[1].eula, undefined);
  // a non-string repoUrl is ignored
  assert.equal(buildStoreCatalog([{ ...stableApp, insiders: { repoUrl: 5 } }], [])[0].variants.length, 1);
});

test("sideload sources must be in /home", () => {
  assert.equal(isHomeVirtualPath("/home"), true);
  assert.equal(isHomeVirtualPath("/home/Projects/app"), true);
  for (const bad of ["/homework", "/home2/x", "/etc", "/", "", null, undefined, 4]) assert.equal(isHomeVirtualPath(bad), false);
});

test("isInside compares whole path segments", () => {
  const base = path.join(path.sep, "srv", "home");
  assert.equal(isInside(base, base), true);
  assert.equal(isInside(base, path.join(base, "a", "b")), true);
  assert.equal(isInside(base, base + "-other"), false);
  assert.equal(isInside(base, path.join(path.sep, "srv")), false);
});

test("sideload copy filter skips .git, node_modules and symbolic links", t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mw-sideload-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, "src");
  fs.mkdirSync(path.join(dir, "node_modules"), { recursive: true });
  fs.mkdirSync(path.join(dir, ".git"));
  fs.writeFileSync(path.join(dir, "index.html"), "<html></html>");
  assert.equal(sideloadCopyFilter(path.join(dir, "index.html")), true);
  assert.equal(sideloadCopyFilter(path.join(dir, "node_modules")), false);
  assert.equal(sideloadCopyFilter(path.join(dir, ".git", "config")), false);
  assert.equal(sideloadCopyFilter(path.join(dir, "missing.txt")), false);
  const link = path.join(dir, "secret.html");
  try { fs.symlinkSync(root, link); } catch (e) { return t.skip("symlinks are not allowed here"); }
  assert.equal(sideloadCopyFilter(link), false);
  // a real copy leaves the link and the ignored folders behind
  const target = path.join(root, "out");
  fs.cpSync(dir, target, { recursive: true, filter: sideloadCopyFilter });
  assert.deepEqual(fs.readdirSync(target).sort(), ["index.html"]);
});

test("sideload labels are trimmed, capped and string-only", () => {
  assert.deepEqual(sideloadLabels("todo", {}), { title: "todo", icon: "" });
  assert.deepEqual(sideloadLabels("todo", { title: "  My Todo  ", icon: " ✅ " }), { title: "My Todo", icon: "✅" });
  assert.deepEqual(sideloadLabels("todo", { title: { x: 1 }, icon: ["a"] }), { title: "todo", icon: "" });
  assert.equal(sideloadLabels("todo", { title: "x".repeat(500), icon: "y".repeat(500) }).title.length, 80);
  assert.equal(sideloadLabels("todo", { title: "x", icon: "y".repeat(500) }).icon.length, 300);
});
