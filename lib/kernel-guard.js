// hyadeOS launcher guards: what keeps the start-up screen from lasting forever.
// (C) 2026 mariowstech and the hyadeOS team - Licensed under the Apache License, Version 2.0
//
// The launcher shows a start-up screen while the kernel (server.js) starts. Three things could leave the user
// on that screen for good, with no recovery screen and no way out:
//  1. `npm install` (the repair for a missing package) ran with no time limit: if it hung, nothing else happened.
//  2. A kernel that cannot even be started (spawn error): Node then emits only 'error', never 'exit', and the
//     launcher restarts, rolls back and shows the recovery screen only on 'exit'.
//  3. Nothing watched the clock: whatever the cause, no timer ever said "this has taken too long".
// These helpers fix those, and are plain functions so they can be tested without Electron.

const fs = require("fs");
const path = require("path");
const { spawn: realSpawn } = require("child_process");

// The packages the kernel needs that are not in node_modules (an update interrupted halfway leaves some out).
function findMissingKernelDependencies(root) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  return Object.keys(manifest.dependencies || {})
    .filter(name => !fs.existsSync(path.join(root, "node_modules", ...name.split("/"), "package.json")));
}

// Stops a process and what it started: `npm` is a .cmd shim on Windows, run through a shell.
function killTree(child, spawnFn = realSpawn) {
  if (!child) return;
  try {
    if (process.platform === "win32" && child.pid) spawnFn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { windowsHide: true, stdio: "ignore" });
    else child.kill();
  } catch (error) { /* already gone */ }
}

// `npm install` for the kernel's packages. Resolves true on success and false on failure, error or time out:
// never hangs.
function installKernelDependencies(root, { spawnFn = realSpawn, timeoutMs = 120000, log = console } = {}) {
  return new Promise(resolve => {
    let finished = false;
    let timer = null;
    const finish = ok => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(ok);
    };
    // Fixed command string: npm is a .cmd shim on Windows, so it needs a shell.
    const child = spawnFn("npm install --omit=dev --no-audit --no-fund", {
      cwd: root, shell: true, stdio: ["ignore", "pipe", "pipe"], windowsHide: true
    });
    timer = setTimeout(() => {
      log.error(`[sniffer]: npm install did not finish in ${Math.round(timeoutMs / 1000)} s; giving up.`);
      killTree(child, spawnFn);
      finish(false);
    }, timeoutMs);
    if (child.stdout) child.stdout.on("data", data => log.log(`[npm]: ${data.toString().trim()}`));
    if (child.stderr) child.stderr.on("data", data => log.error(`[npm]: ${data.toString().trim()}`));
    child.on("error", error => {
      log.error("[sniffer]: could not run npm:", error.message);
      finish(false);
    });
    child.on("exit", code => finish(code === 0));
  });
}

// Calls handler(code, signal, error) once when the process is gone: on 'exit', or when it could not be started
// at all (Node emits only 'error' then, with code 'spawn-error' here).
function watchChildGone(child, handler) {
  let called = false;
  const once = (code, signal, error) => {
    if (called) return;
    called = true;
    handler(code, signal, error);
  };
  child.on("exit", (code, signal) => once(code, signal));
  child.on("error", error => { if (child.pid === undefined) once("spawn-error", null, error); });
}

// A timer that can be armed (kept if already armed) and disarmed.
function createWatchdog(ms, onExpire, { setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null;
  return {
    arm() {
      if (timer !== null) return;
      timer = setTimer(() => { timer = null; onExpire(); }, ms);
    },
    disarm() {
      if (timer === null) return;
      clearTimer(timer);
      timer = null;
    },
    get armed() { return timer !== null; }
  };
}

// Packages are missing right after an update that was never confirmed to boot (its restore point is not marked
// verified): the update was most likely interrupted. Going back to the restore point is safer, and much faster,
// than `npm install` on top of a half-replaced node_modules.
function shouldRestoreBeforeRepair(root, missing, rollbackLib) {
  if (!missing || !missing.length) return false;
  try {
    if (!rollbackLib.canRollback(root)) return false;
    const point = rollbackLib.readRollbackPoint(root);
    return Boolean(point) && !point.verified && !point.rolledBack;
  } catch (error) {
    return false;
  }
}

module.exports = { findMissingKernelDependencies, installKernelDependencies, killTree, watchChildGone, createWatchdog, shouldRestoreBeforeRepair };
