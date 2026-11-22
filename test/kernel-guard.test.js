// The start-up screen must never last forever: a missing package, a kernel that cannot start, an `npm install`
// that hangs. These tests hold the helpers the launcher uses (lib/kernel-guard.js) and how it wires them.
const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("events");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const guard = require("../lib/kernel-guard");
const rollback = require("../lib/rollback");

const tempRoot = () => fs.mkdtempSync(path.join(os.tmpdir(), "hyadeos-guard-test-"));
const removeRoot = root => { try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (error) { /* a temp folder left behind is not a failure */ } };

test("missing kernel packages are found, scoped ones included", () => {
  const root = tempRoot();
  try {
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ dependencies: { express: "1", "@scope/pkg": "1", bcrypt: "1" } }));
    fs.mkdirSync(path.join(root, "node_modules", "express"), { recursive: true });
    fs.writeFileSync(path.join(root, "node_modules", "express", "package.json"), "{}");
    fs.mkdirSync(path.join(root, "node_modules", "bcrypt"), { recursive: true }); // folder there, package.json not copied yet
    assert.deepEqual(guard.findMissingKernelDependencies(root).sort(), ["@scope/pkg", "bcrypt"]);
  } finally { removeRoot(root); }
});

// A stand-in for child_process.spawn: records the calls and gives back a child the test controls.
function fakeSpawn() {
  const calls = [];
  const children = [];
  const spawnFn = (command, args) => {
    const child = new EventEmitter();
    child.pid = 4242;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; };
    calls.push([command, args]);
    children.push(child);
    return child;
  };
  return { spawnFn, calls, children };
}
const quietLog = { log() {}, error() {} };

test("an npm install that never finishes is given up on instead of waiting forever", async () => {
  const fake = fakeSpawn();
  const started = Date.now();
  const ok = await guard.installKernelDependencies("/somewhere", { spawnFn: fake.spawnFn, timeoutMs: 60, log: quietLog });
  assert.equal(ok, false);
  assert.ok(Date.now() - started < 5000, "it did not wait for npm");
  // npm was stopped: the child itself, or taskkill on Windows (npm is a shim there).
  assert.ok(fake.children[0].killed || fake.calls.some(call => call[0] === "taskkill"), "npm was stopped");
});

test("npm install reports success, failure and errors", async () => {
  for (const [event, args, expected] of [["exit", [0], true], ["exit", [1], false], ["error", [new Error("ENOENT")], false]]) {
    const fake = fakeSpawn();
    const pending = guard.installKernelDependencies("/somewhere", { spawnFn: fake.spawnFn, timeoutMs: 5000, log: quietLog });
    fake.children[0].emit(event, ...args);
    assert.equal(await pending, expected, `${event} ${args[0]}`);
  }
});

test("a kernel that cannot be started counts as gone, once (Node emits only 'error' then)", async () => {
  const gone = [];
  const child = spawn("hyadeos-no-such-program-xyz", ["server.js"], { stdio: "ignore" });
  guard.watchChildGone(child, (code, signal, error) => gone.push([code, signal, error && error.code]));
  await new Promise(resolve => setTimeout(resolve, 600));
  assert.deepEqual(gone, [["spawn-error", null, "ENOENT"]], "the launcher would restart, roll back or show the recovery screen");
});

test("a kernel that starts and then exits counts as gone with its exit code, once", async () => {
  const gone = [];
  const child = spawn(process.execPath, ["-e", "process.exit(3)"], { stdio: "ignore" });
  guard.watchChildGone(child, (code, signal) => gone.push([code, signal]));
  await new Promise(resolve => child.once("close", resolve));
  await new Promise(resolve => setTimeout(resolve, 50));
  assert.deepEqual(gone, [[3, null]]);
});

test("the watchdog fires once after its time, can be re-armed without stacking, and can be disarmed", () => {
  const timers = [];
  let fired = 0;
  const watchdog = guard.createWatchdog(1000, () => { fired++; }, {
    setTimer: (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length - 1; },
    clearTimer: id => { timers[id].cleared = true; }
  });
  assert.equal(watchdog.armed, false);
  watchdog.arm();
  watchdog.arm(); // already armed: kept
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, 1000);
  assert.equal(watchdog.armed, true);
  timers[0].fn();
  assert.equal(fired, 1);
  assert.equal(watchdog.armed, false);
  watchdog.arm();
  watchdog.disarm();
  assert.equal(timers[1].cleared, true);
  assert.equal(watchdog.armed, false);
  assert.equal(fired, 1, "a disarmed watchdog never fires");
});

test("missing packages after an unconfirmed update mean go back, not npm install", () => {
  const root = tempRoot();
  try {
    assert.equal(guard.shouldRestoreBeforeRepair(root, ["express"], rollback), false, "no restore point: a fresh install, repair it");
    rollback.createRollbackPoint(root, [], { toVersion: "2.1.0" });
    assert.equal(guard.shouldRestoreBeforeRepair(root, [], rollback), false, "nothing missing");
    assert.equal(guard.shouldRestoreBeforeRepair(root, ["express"], rollback), true, "the update never booted: restore it");
    rollback.markRollbackVerified(root);
    assert.equal(guard.shouldRestoreBeforeRepair(root, ["express"], rollback), false, "the update booted fine once: this is something else");
  } finally { removeRoot(root); }
});

test("a restore point that was already used is not offered again", () => {
  const root = tempRoot();
  try {
    rollback.createRollbackPoint(root, [], { toVersion: "2.1.0" });
    rollback.restoreRollbackPoint(root);
    assert.equal(guard.shouldRestoreBeforeRepair(root, ["express"], rollback), false);
  } finally { removeRoot(root); }
});

test("the launcher is wired to all of it", () => {
  const launcher = fs.readFileSync(path.join(__dirname, "..", "launcher.js"), "utf8");
  assert.match(launcher, /kernelGuard\.watchChildGone\(child,/, "a kernel that cannot start is handled like one that exited");
  assert.match(launcher, /kernelGuard\.installKernelDependencies\(__dirname, \{ timeoutMs: NPM_INSTALL_LIMIT_MS \}\)/);
  assert.match(launcher, /kernelGuard\.shouldRestoreBeforeRepair\(__dirname, missing, rollback\)/);
  assert.match(launcher, /const bootWatchdog = kernelGuard\.createWatchdog\(KERNEL_START_LIMIT_MS/);
  // Armed whenever the start-up screen is shown or the kernel is started, disarmed once the kernel answers.
  assert.match(launcher, /function showBootScreen\(\) \{\s*bootWatchdog\.arm\(\);/);
  assert.match(launcher, /backendReady = true;\s*bootWatchdog\.disarm\(\);/);
  assert.match(launcher, /function showKernelRecovery\(\) \{\s*inKernelRecovery = true;\s*bootWatchdog\.disarm\(\);/);
  assert.doesNotMatch(launcher, /child\.on\('exit', \(code, signal\) => \{\s*if \(backendProcess === child\)/, "the exit handler is not bound to 'exit' alone any more");
});
