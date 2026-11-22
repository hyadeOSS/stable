// Tests for main.js of the installer. Run:  node --test installer/test   (needs only Node 18+, no Electron)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const m = require("../main.js");

const quiet = { log() {}, error() {} };
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "hyadeos-installer-test-"));
const write = (root, rel, text) => { const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), "utf8");
const system = (root, version, extra = {}) => {
  write(root, "version.json", JSON.stringify({ version }));
  write(root, "server.js", `server ${version}`);
  write(root, "launcher.js", `launcher ${version}`);
  for (const [rel, text] of Object.entries(extra)) write(root, rel, text);
};
const cleanup = (...dirs) => dirs.forEach(d => { try { fs.rmSync(d, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (e) { /* temp */ } });

test("version order is semantic: a release is newer than its own betas, beta.10 than beta.4", () => {
  assert.equal(m.isNewer("2.0.5", "2.0.4"), true);
  assert.equal(m.isNewer("2.0.4", "2.0.4"), false);
  assert.equal(m.isNewer("2.0.3", "2.0.4"), false);
  assert.equal(m.isNewer("2.1.0", "2.1.0-beta.4"), true, "the old comparison said the opposite");
  assert.equal(m.isNewer("2.1.0-beta.4", "2.1.0"), false);
  assert.equal(m.isNewer("2.1.0-beta.10", "2.1.0-beta.4"), true);
  assert.equal(m.isNewer("2.1.0-beta.2", "2.1.0-beta.4"), false);
  assert.equal(m.isNewer("2.0.5", "2.1.0-beta.1"), false, "a stable older than the installed beta does not replace it");
  assert.equal(m.isNewer("2.1.1", "2.1.0-beta.4"), true);
  assert.equal(m.isNewer("2.0.5", null), true);
});

test("a name that is not a semantic version keeps the old behaviour (Insiders builds)", () => {
  assert.equal(m.isNewer("2.0.5", "2.5.1_DEVPREVIEW3"), false);
  assert.equal(m.isNewer("3.0.0", "2.5.1_DEVPREVIEW3"), true);
  assert.equal(m.isNewer("2.5.1_DEVPREVIEW3", "2.0.4"), m.naiveIsNewer("2.5.1_DEVPREVIEW3", "2.0.4"));
});

test("a fresh install copies the bundled system", () => {
  const bundled = tmp(), data = tmp(), runtime = path.join(data, "system");
  try {
    system(bundled, "2.0.5", { "desktop/a.html": "a" });
    assert.equal(m.prepareRuntimeSystem({ bundledSystem: bundled, runtimeSystem: runtime, log: quiet }), true);
    assert.equal(read(runtime, "server.js"), "server 2.0.5");
    assert.equal(read(runtime, "desktop/a.html"), "a");
  } finally { cleanup(bundled, data); }
});

test("a newer installer replaces the code but never the user's data", () => {
  const bundled = tmp(), data = tmp(), runtime = path.join(data, "system");
  try {
    system(bundled, "2.0.5", { "lib/new.js": "new" });
    system(runtime, "2.0.4", { "config.json": "MY SETTINGS", "desktop/home/notes.txt": "MY NOTES", "keys.json": "MY KEYS" });
    assert.equal(m.prepareRuntimeSystem({ bundledSystem: bundled, runtimeSystem: runtime, log: quiet }), true);
    assert.equal(read(runtime, "server.js"), "server 2.0.5");
    assert.equal(read(runtime, "lib/new.js"), "new");
    assert.equal(read(runtime, "config.json"), "MY SETTINGS");
    assert.equal(read(runtime, "desktop/home/notes.txt"), "MY NOTES");
    assert.equal(read(runtime, "keys.json"), "MY KEYS");
  } finally { cleanup(bundled, data); }
});

test("the same version leaves the copy alone, so updates installed from Settings persist", () => {
  const bundled = tmp(), data = tmp(), runtime = path.join(data, "system");
  try {
    system(bundled, "2.0.5");
    system(runtime, "2.0.5", { "server.js": "UPDATED BY OTA" });
    assert.equal(m.prepareRuntimeSystem({ bundledSystem: bundled, runtimeSystem: runtime, log: quiet }), false);
    assert.equal(read(runtime, "server.js"), "UPDATED BY OTA");
  } finally { cleanup(bundled, data); }
});

test("first start after the rename: the data comes over from the hyadeOSS folder, the code from the installer", () => {
  const bundled = tmp(), appData = tmp();
  const legacy = path.join(appData, "hyadeOSS"), userData = path.join(appData, "hyadeOS"), runtime = path.join(userData, "system");
  try {
    system(bundled, "2.0.5", { "lib/kernel-guard.js": "guard" });
    system(path.join(legacy, "system"), "2.0.4", { "config.json": "MY SETTINGS", "desktop/home/notes.txt": "MY NOTES", "lib/old.js": "old" });
    write(legacy, "Cache/big.bin", "x".repeat(50)); write(legacy, "GPUCache/g.bin", "g"); write(legacy, "Local Storage/leveldb/1.ldb", "kept");
    const from = m.migrateLegacyData({ appData, userData, runtimeSystem: runtime, bundledSystem: bundled, log: quiet });
    assert.equal(from, legacy);
    assert.equal(read(runtime, "config.json"), "MY SETTINGS", "settings kept");
    assert.equal(read(runtime, "desktop/home/notes.txt"), "MY NOTES", "notes kept");
    assert.equal(read(userData, "Local Storage/leveldb/1.ldb"), "kept", "the app's own data kept");
    assert.equal(read(runtime, "server.js"), "server 2.0.5", "the code is the installer's");
    assert.equal(read(runtime, "lib/kernel-guard.js"), "guard");
    assert.equal(fs.existsSync(path.join(userData, "Cache")), false, "caches are not copied");
    assert.equal(fs.existsSync(path.join(userData, "GPUCache")), false);
    assert.equal(read(path.join(legacy, "system"), "config.json"), "MY SETTINGS", "the old folder is left as it was");
  } finally { cleanup(bundled, appData); }
});

test("a copy left half updated (a beta, interrupted) is repaired by installing", () => {
  const bundled = tmp(), appData = tmp();
  const legacy = path.join(appData, "hyadeOSS"), userData = path.join(appData, "hyadeOS"), runtime = path.join(userData, "system");
  try {
    system(bundled, "2.0.5");
    // New launcher, old server, missing pieces: what an update killed at 70% leaves. Version still says beta.
    system(path.join(legacy, "system"), "2.1.0-beta.1", { "launcher.js": "NEW LAUNCHER", "server.js": "OLD SERVER", "config.json": "MY SETTINGS" });
    fs.rmSync(path.join(legacy, "system", "version.json")); write(path.join(legacy, "system"), "version.json", JSON.stringify({ version: "2.1.0-beta.1" }));
    m.migrateLegacyData({ appData, userData, runtimeSystem: runtime, bundledSystem: bundled, log: quiet });
    assert.equal(read(runtime, "launcher.js"), "launcher 2.0.5");
    assert.equal(read(runtime, "server.js"), "server 2.0.5");
    assert.equal(read(runtime, "config.json"), "MY SETTINGS");
    // And prepareRuntimeSystem afterwards has nothing left to do (same version as the bundle).
    assert.equal(m.prepareRuntimeSystem({ bundledSystem: bundled, runtimeSystem: runtime, log: quiet }), false);
  } finally { cleanup(bundled, appData); }
});

test("nothing is migrated when the new folder already has a system, or there is no old one", () => {
  const bundled = tmp(), appData = tmp();
  const legacy = path.join(appData, "hyadeOSS"), userData = path.join(appData, "hyadeOS"), runtime = path.join(userData, "system");
  try {
    system(bundled, "2.0.5");
    assert.equal(m.migrateLegacyData({ appData, userData, runtimeSystem: runtime, bundledSystem: bundled, log: quiet }), null, "no old folder");
    system(path.join(legacy, "system"), "2.0.4", { "config.json": "OLD" });
    system(runtime, "2.0.5", { "config.json": "NEW" });
    assert.equal(m.migrateLegacyData({ appData, userData, runtimeSystem: runtime, bundledSystem: bundled, log: quiet }), null, "already migrated");
    assert.equal(read(runtime, "config.json"), "NEW");
  } finally { cleanup(bundled, appData); }
});

test("the oldest name (mariowOS) is still brought over when hyadeOSS has nothing", () => {
  const bundled = tmp(), appData = tmp();
  const userData = path.join(appData, "hyadeOS"), runtime = path.join(userData, "system");
  try {
    system(bundled, "2.0.5");
    system(path.join(appData, "mariowOS", "system"), "2.0.2", { "config.json": "FROM MARIOW" });
    assert.equal(m.migrateLegacyData({ appData, userData, runtimeSystem: runtime, bundledSystem: bundled, log: quiet }), path.join(appData, "mariowOS"));
    assert.equal(read(runtime, "config.json"), "FROM MARIOW");
  } finally { cleanup(bundled, appData); }
});

test("the launcher gets both spellings of its environment", () => {
  const env = {};
  m.setLauncherEnvironment(env, "C:\\app\\hyadeOS.exe");
  assert.deepEqual(env, {
    HYADEOS_NODE_EXECUTABLE: "C:\\app\\hyadeOS.exe", HYADEOS_PACKAGED: "1",
    HYADEOSS_NODE_EXECUTABLE: "C:\\app\\hyadeOS.exe", HYADEOSS_PACKAGED: "1"
  });
});

test("outside Electron the file only exports: requiring it starts nothing", () => {
  assert.equal(typeof m.isNewer, "function");
  assert.equal(process.versions.electron, undefined);
});
