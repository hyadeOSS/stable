// Entry point of the INSTALLED hyadeOS app (electron-builder). Development keeps using
// `npm run start-os` (system/launcher.js directly).
//
// The installer ships a copy of system/ under resources/system, which is read-only once
// installed. hyadeOS updates itself and keeps its data next to its code, so the system
// runs from a writable copy in the user's app-data folder:
//   - first start: resources/system is copied there;
//   - after installing a newer hyadeOS: the new files are copied over the old ones
//     (the bundle contains no user data, so config, notes and keys are never touched);
//   - otherwise the copy is left alone, so OTA updates installed from Settings persist.
// The kernel then runs with Electron's own Node.js: no separate Node install is needed.
//
// The data folder is named after the app, so the rename hyadeOSS -> hyadeOS moves it from
// %APPDATA%\hyadeOSS to %APPDATA%\hyadeOS. The old folder is brought over once (migrateLegacyData),
// and its code is replaced by the bundled one: the bundle holds no user data, so this is safe, and it
// repairs a copy that an interrupted update left half replaced.

const fs = require("fs");
const path = require("path");

// ---- Version order ------------------------------------------------------------------------------------

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

function parseVersion(version) {
  const match = SEMVER.exec(String(version || "").trim());
  if (!match) return null;
  return { release: [Number(match[1]), Number(match[2]), Number(match[3])], prerelease: match[4] ? match[4].split(".") : [] };
}

// Semantic Versioning order: 2.1.0 is newer than 2.1.0-beta.4, and beta.10 is newer than beta.4.
// (The old comparison read "2.1.0-beta.4" as 2.1.0.0.4, which made a release look older than its own beta.)
function compareVersions(left, right) {
  for (let i = 0; i < 3; i++) {
    if (left.release[i] !== right.release[i]) return left.release[i] < right.release[i] ? -1 : 1;
  }
  const a = left.prerelease, b = right.prerelease;
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1;
  if (!b.length) return -1;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === undefined) return -1;
    if (b[i] === undefined) return 1;
    const x = /^\d+$/.test(a[i]), y = /^\d+$/.test(b[i]);
    if (x && y) { if (Number(a[i]) !== Number(b[i])) return Number(a[i]) < Number(b[i]) ? -1 : 1; }
    else if (x !== y) return x ? -1 : 1;
    else if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
  }
  return 0;
}

// The comparison used before semantic versions: numeric, part by part. Kept for names that are not a
// semantic version (an Insiders build such as "2.5.1_DEVPREVIEW3"), so those behave as they always did.
function naiveIsNewer(candidate, current) {
  if (!current) return true;
  const a = String(candidate || "").split(/[.-]/).map(Number);
  const b = String(current).split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = Number.isFinite(a[i]) ? a[i] : 0;
    const y = Number.isFinite(b[i]) ? b[i] : 0;
    if (x !== y) return x > y;
  }
  return false;
}

function isNewer(candidate, current) {
  if (!current) return true;
  const a = parseVersion(candidate), b = parseVersion(current);
  if (a && b) return compareVersions(a, b) > 0;
  return naiveIsNewer(candidate, current);
}

// ---- The writable copy of the system --------------------------------------------------------------------

function readVersion(systemDir, fileSystem = fs) {
  try { return JSON.parse(fileSystem.readFileSync(path.join(systemDir, "version.json"), "utf8")).version || null; }
  catch (e) { return null; }
}

// Chromium's caches and lock files are rebuilt on their own: not worth copying.
const SKIP_WHEN_MIGRATING = /[\\/](?:Cache|Code Cache|GPUCache|DawnCache|ShaderCache|GrShaderCache|Singleton[^\\/]*)(?:[\\/]|$)/;

// Folders the data may still be in, newest name first: the app was called mariowOS, then hyadeOSS.
const LEGACY_DATA_FOLDERS = ["hyadeOSS", "mariowOS"];

// First start under the new name: bring the old data folder over once, then put the bundled code over the
// copied code. Returns the folder it migrated from, or null.
function migrateLegacyData({ appData, userData, runtimeSystem, bundledSystem, fileSystem = fs, log = console }) {
  if (fileSystem.existsSync(path.join(runtimeSystem, "server.js"))) return null; // already has a system
  for (const name of LEGACY_DATA_FOLDERS) {
    const legacy = path.join(appData, name);
    if (path.resolve(legacy) === path.resolve(userData)) continue;
    if (!fileSystem.existsSync(path.join(legacy, "system"))) continue;
    try {
      fileSystem.cpSync(legacy, userData, { recursive: true, force: false, filter: source => !SKIP_WHEN_MIGRATING.test(source) });
      log.log(`[installer]: migrated data from ${legacy}`);
      // The copied code may be old, or half replaced by an update that was interrupted: use the bundled one.
      // The bundle holds no user data (config, notes, keys), so nothing of the user's is overwritten.
      fileSystem.cpSync(bundledSystem, runtimeSystem, { recursive: true, force: true });
      log.log(`[installer]: system code refreshed from the installer (${readVersion(bundledSystem, fileSystem) || "?"})`);
      return legacy;
    } catch (error) {
      log.error(`[installer]: data migration from ${legacy} failed: ${error.message}`);
    }
  }
  return null;
}

// An Insiders build ("2.5.1_DEVPREVIEW5") is not a semantic version, and its number (2.5) looks newer than any
// release (2.1), so comparing them would keep the Insiders code for ever after installing a release over it.
// Installing a release is a deliberate choice: the installer's code replaces it (the data stays).
function isInsiderBuild(version) {
  return !!version && !parseVersion(version);
}

// The Insiders channel is only reachable from an Insiders build; on a release the Updater would offer the
// Insiders build again. Only that one key of config.json changes. Returns true when it was changed.
function resetInsiderChannel(runtimeSystem, { fileSystem = fs, log = console } = {}) {
  const file = path.join(runtimeSystem, "config.json");
  try {
    if (!fileSystem.existsSync(file)) return false;
    const config = JSON.parse(fileSystem.readFileSync(file, "utf8"));
    if (!config || typeof config !== "object" || String(config.updateChannel || "").toLowerCase() !== "insiders") return false;
    config.updateChannel = "stable";
    fileSystem.writeFileSync(file, JSON.stringify(config, null, 2));
    log.log("[installer]: update channel set back to stable");
    return true;
  } catch (error) {
    log.error(`[installer]: could not reset the update channel: ${error.message}`);
    return false;
  }
}

function prepareRuntimeSystem({ bundledSystem, runtimeSystem, fileSystem = fs, log = console }) {
  const bundled = readVersion(bundledSystem, fileSystem);
  const installed = fileSystem.existsSync(path.join(runtimeSystem, "server.js")) ? readVersion(runtimeSystem, fileSystem) : null;
  const fromInsiders = isInsiderBuild(installed) && !!parseVersion(bundled);
  if (installed && !fromInsiders && !isNewer(bundled, installed)) return false;
  log.log(`[installer]: ${installed ? `${fromInsiders ? "replacing the Insiders build" : "upgrading"} ${installed} -> ${bundled}` : `installing ${bundled}`} in ${runtimeSystem}`);
  fileSystem.mkdirSync(runtimeSystem, { recursive: true });
  fileSystem.cpSync(bundledSystem, runtimeSystem, { recursive: true, force: true });
  if (fromInsiders) resetInsiderChannel(runtimeSystem, { fileSystem, log });
  return true;
}

// The launcher starts the kernel as `<HYADEOS_NODE_EXECUTABLE> server.js`: use this very executable in Node
// mode; the launcher sets ELECTRON_RUN_AS_NODE for the kernel only (Chromium's own GPU/network helpers
// inherit this process's env and would break). Both spellings are set: the system in the data folder may be
// from before the rename (it reads HYADEOSS_*), or after it (it reads HYADEOS_* first).
function setLauncherEnvironment(env, executable) {
  for (const prefix of ["HYADEOS_", "HYADEOSS_"]) {
    env[prefix + "NODE_EXECUTABLE"] = executable;
    env[prefix + "PACKAGED"] = "1";
  }
}

function run() {
  const { app } = require("electron");
  const bundledSystem = path.join(process.resourcesPath, "system");
  const userData = app.getPath("userData");
  const runtimeSystem = path.join(userData, "system");
  migrateLegacyData({ appData: app.getPath("appData"), userData, runtimeSystem, bundledSystem });
  prepareRuntimeSystem({ bundledSystem, runtimeSystem });
  setLauncherEnvironment(process.env, process.execPath);
  require(path.join(runtimeSystem, "launcher.js"));
}

module.exports = { parseVersion, compareVersions, isNewer, naiveIsNewer, readVersion, migrateLegacyData, prepareRuntimeSystem, isInsiderBuild, resetInsiderChannel, setLauncherEnvironment, LEGACY_DATA_FOLDERS };

// Inside Electron this file is the entry point; under Node (the tests) it only exports the functions above.
if (process.versions.electron) run();
