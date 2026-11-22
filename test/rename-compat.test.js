// The project used to be spelled "hyadeOSS" and is now "hyadeOS". These tests hold the few places where the
// old spelling is still understood, so installs and apps from before the rename keep working:
//  - the HYADEOSS_* environment variables (an old launcher starts a new server with them),
//  - the app SDK (window.hyadeOSS, hyadeoss-app.js) and the app manifest name (hyadeoss.json),
//  - the Tiles desktop file installed under the old prefix.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const vm = require("vm");
const { spawn } = require("child_process");
const { envVar, envPair } = require("../lib/env");
const { isListedDesktop, LEGACY_TWM_FILE } = require("../lib/legacy-names");

const SYSTEM = path.join(__dirname, "..");

test("envVar reads the new name, then the legacy one, and treats empty as unset", () => {
  assert.equal(envVar("PORT", { HYADEOS_PORT: "3100", HYADEOSS_PORT: "3200" }), "3100");
  assert.equal(envVar("PORT", { HYADEOSS_PORT: "3200" }), "3200");
  assert.equal(envVar("PORT", { HYADEOS_PORT: "", HYADEOSS_PORT: "3200" }), "3200");
  assert.equal(envVar("PORT", {}), undefined);
});

test("envPair gives the same value under both names", () => {
  assert.deepEqual(envPair("SHUTDOWN_TOKEN", "abc"), { HYADEOS_SHUTDOWN_TOKEN: "abc", HYADEOSS_SHUTDOWN_TOKEN: "abc" });
});

test("the desktop picker lists new desktops and an old Tiles install, never the old core pages", () => {
  assert.equal(isListedDesktop("com.hyadeos.desktop.html"), true);
  assert.equal(isListedDesktop("com.hyadeos.twm.html"), true);
  assert.equal(isListedDesktop(LEGACY_TWM_FILE), true);
  assert.equal(isListedDesktop("com.hyadeoss.desktop.html"), false, "left over from before the update");
  assert.equal(isListedDesktop("com.hyadeoss.loginui.html"), false);
  assert.equal(isListedDesktop("com.hyadeoss.lockscreen.html"), false);
  assert.equal(isListedDesktop("com.hyadeos.loginui.html"), false);
  assert.equal(isListedDesktop("welcome.html"), false);
});

// A page just big enough for the SDK to load: it only needs to define window.hyadeOS.
function loadSdk() {
  const sandbox = {
    console,
    setTimeout, clearTimeout,
    addEventListener() {}, removeEventListener() {},
    postMessage() {},
    document: { documentElement: { style: {}, dataset: {} }, head: { appendChild() {} }, addEventListener() {}, createElement: () => ({ style: {} }) },
    FileReader: function () {}, Blob: function () {}, URL, Promise, Object, Error, Math, Date, JSON, String, Number, Array, Set, Map, Symbol
  };
  sandbox.window = sandbox;
  sandbox.parent = sandbox;
  sandbox.location = { href: "http://127.0.0.1/app/index.html", origin: "http://127.0.0.1" };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(SYSTEM, "desktop/assets/sdk/hyadeos-app.js"), "utf8"), sandbox);
  return sandbox;
}

test("the app SDK defines window.hyadeOS and keeps window.hyadeOSS as an alias", () => {
  const sdk = loadSdk();
  assert.ok(sdk.hyadeOS && sdk.hyadeOS.sdkVersion, "window.hyadeOS exists");
  assert.equal(sdk.hyadeOSS, sdk.hyadeOS, "the old global is the same object");
  assert.equal(typeof sdk.hyadeOSS.notify, "function");
});

test("the old SDK file name loads the current one from the same place", () => {
  const source = fs.readFileSync(path.join(SYSTEM, "desktop/assets/sdk/hyadeoss-app.js"), "utf8");
  const written = [];
  const sandbox = {
    document: {
      currentScript: { src: "http://127.0.0.1:3000/desktop/assets/sdk/hyadeoss-app.js?v=2" },
      readyState: "loading",
      write: html => written.push(html)
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  assert.equal(written.length, 1);
  assert.match(written[0], /src="http:\/\/127\.0\.0\.1:3000\/desktop\/assets\/sdk\/hyadeos-app\.js\?v=2"/);
});

test("the old SDK file adds a script element once the page is already loaded", () => {
  const source = fs.readFileSync(path.join(SYSTEM, "desktop/assets/sdk/hyadeoss-app.js"), "utf8");
  const added = [];
  const sandbox = {
    document: {
      currentScript: { src: "https://app.example/hyadeoss-app.js" },
      readyState: "complete",
      createElement: () => ({}),
      head: { appendChild: node => added.push(node) }
    }
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  assert.equal(added.length, 1);
  assert.equal(added[0].src, "https://app.example/hyadeos-app.js");
});

// Starts a real kernel with exactly the environment given (an OLD launcher only knows HYADEOSS_*).
const SKIP = [/^node_modules/, /^\.rollback/, /^test[\\/]/, /^desktop[\\/]home/, /\.log$/,
  /^(config\.json|keys\.json|session\.key|\.env|spotify-token\.json|desktop[\\/]notes-db\.json)$/];

async function startKernel(env) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hyadeos-compat-test-"));
  fs.cpSync(SYSTEM, root, { recursive: true, filter: source => {
    const relative = path.relative(SYSTEM, source);
    return !relative || !SKIP.some(pattern => pattern.test(relative));
  } });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { PATH: process.env.PATH, NODE_PATH: path.join(SYSTEM, "node_modules"), ...env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; });
  child.stderr.on("data", chunk => { output += chunk; });
  const exited = new Promise(resolve => child.once("exit", code => resolve(code)));
  const port = Number(env.HYADEOS_PORT || env.HYADEOSS_PORT);
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try { if ((await fetch(`http://127.0.0.1:${port}/api/system/health`)).ok) return { child, root, port, exited, output: () => output }; } catch (e) {}
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  child.kill();
  throw new Error(`kernel did not start:\n${output}`);
}

test("a new server started by an OLD launcher (only HYADEOSS_* set) still works end to end", async () => {
  const port = 40000 + Math.floor(Math.random() * 1000);
  const kernel = await startKernel({
    HYADEOSS_PORT: String(port),
    HYADEOSS_MANAGED_BACKEND: "1",
    HYADEOSS_SHUTDOWN_TOKEN: "legacy-token",
    HYADEOSS_MAIL_RELAY_URL: "http://127.0.0.1:9"
  });
  try {
    const url = `http://127.0.0.1:${port}/api/system/shutdown`;
    const wrong = await fetch(url, { method: "POST", headers: { authorization: "Bearer nope" } });
    assert.equal(wrong.status, 403, "a wrong token is refused");
    const right = await fetch(url, { method: "POST", headers: { authorization: "Bearer legacy-token" } });
    assert.equal(right.status, 202, "the legacy managed-backend flag and token are honoured");
    assert.equal(await kernel.exited, 20, "and the server stops with the SHUTDOWN exit code the launcher expects");
  } finally {
    kernel.child.kill();
    fs.rmSync(kernel.root, { recursive: true, force: true });
  }
});

test("a server started with the new HYADEOS_* names works too", async () => {
  const port = 41000 + Math.floor(Math.random() * 1000);
  const kernel = await startKernel({ HYADEOS_PORT: String(port), HYADEOS_MAIL_RELAY_URL: "http://127.0.0.1:9" });
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/system/health`);
    assert.equal(response.status, 200);
  } finally {
    kernel.child.kill();
    fs.rmSync(kernel.root, { recursive: true, force: true });
  }
});
