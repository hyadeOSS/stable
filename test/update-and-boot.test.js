// What the user sees while the system starts, updates and is set up. These pages run in a browser, so they are
// checked here as text (the behaviour was also tried in a real browser), plus the one kernel fact the launcher needs.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const SYSTEM = path.join(__dirname, "..");
const read = relative => fs.readFileSync(path.join(SYSTEM, relative), "utf8");

test("the boot page works when the launcher shows it from disk (no API, no absolute paths)", () => {
  const html = read("boot.html");
  // From file:// an absolute /desktop/... path points at the root of the drive: the logo was a broken image.
  assert.match(html, /<img id="bootLogo" src="desktop\/assets\/icons\/stars\.png"/);
  // From disk it must not run the API loop, which can only fail and printed an error on every normal start.
  assert.match(html, /location\.protocol === 'file:'/);
  assert.match(html, /if \(startedFromDisk\) \{[\s\S]*?return;\s*\}/);
  // When served, the error shows only after repeated failures.
  assert.match(html, /failures >= 3/);
});

test("the setup highlights show only real sections, with no placeholder tabs", () => {
  const html = read("desktop/highlights.html");
  const tabs = html.match(/class="highlight-tab"/g) || [];
  const pictures = html.match(/<img[^>]*id="picture-/g) || [];
  const texts = html.match(/<p class="highlight-text/g) || [];
  assert.equal(tabs.length, 3);
  assert.equal(pictures.length, 3);
  assert.equal(texts.length, 3, "each tab has its own text");
  assert.doesNotMatch(html, /extra-[12]|Section four|Section five|highlight-placeholder/);
  for (const picture of html.match(/src="\/desktop\/assets\/[^"]+\.(?:png|jpg|svg)"/g) || []) {
    const file = picture.slice(6, -1);
    assert.ok(fs.existsSync(path.join(SYSTEM, file)), `${file} exists`);
  }
  const it = JSON.parse(read("desktop/assets/locales/it.json"));
  assert.equal(Object.keys(it).filter(key => /^setup\.highlights\.extra/.test(key)).length, 0);
});

test("the Updater tells the user when the chosen channel is behind, and asks twice before going back", () => {
  const page = read("desktop/apps/settings/assets/update-mirror-2.html");
  assert.match(page, /data\.older/);
  assert.match(page, /confirmOlderInstall/);
  // The second click is what starts the update: the first only asks.
  assert.match(page, /function confirmOlderInstall[\s\S]*?setAction\(action[\s\S]*?startSystemUpdate\)/);
});

test("the launcher does not offer or run a restart while an update is being applied", () => {
  const launcher = read("launcher.js");
  assert.match(launcher, /async function kernelIsUpdating\(\)/);
  assert.match(launcher, /\.updating === true/);
  // Both the popup and the restart button wait for the update to end.
  assert.match(launcher, /if \(await kernelIsUpdating\(\)\) \{\s*restartCheckTimer = setTimeout\(check, 3000\)/);
  assert.match(launcher, /desktopHandler\('relaunch', async \(\) => \{[\s\S]*?if \(await kernelIsUpdating\(\)\) return false;/);
});

const SKIP = [/^node_modules/, /^\.rollback/, /^test[\\/]/, /^desktop[\\/]home/, /\.log$/,
  /^(config\.json|keys\.json|session\.key|\.env|spotify-token\.json|desktop[\\/]notes-db\.json)$/];

test("the kernel says whether an update is running", async () => {
  const port = 44000 + Math.floor(Math.random() * 900);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "hyadeos-health-test-"));
  fs.cpSync(SYSTEM, root, { recursive: true, filter: source => {
    const relative = path.relative(SYSTEM, source);
    return !relative || !SKIP.some(pattern => pattern.test(relative));
  } });
  const child = spawn(process.execPath, ["server.js"], {
    cwd: root,
    env: { PATH: process.env.PATH, NODE_PATH: path.join(SYSTEM, "node_modules"), HYADEOS_PORT: String(port), HYADEOS_MAIL_RELAY_URL: "http://127.0.0.1:9" },
    stdio: "ignore"
  });
  const exited = new Promise(resolve => child.once("exit", resolve));
  try {
    let health = null;
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline && !health) {
      try { health = await (await fetch(`http://127.0.0.1:${port}/api/system/health`)).json(); }
      catch (error) { await new Promise(resolve => setTimeout(resolve, 200)); }
    }
    assert.ok(health, "the kernel answered");
    assert.equal(health.status, "ok");
    assert.equal(health.updating, false, "idle: the launcher may restart the shell");
  } finally {
    // On Windows the folder stays locked until the process has really exited; a leftover temp folder is not a failure.
    child.kill();
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 5000))]);
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (error) { /* left behind in the temp folder */ }
  }
});
