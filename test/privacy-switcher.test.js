// Privacy mode and the Alt+Tab window switcher live in the desktop page; checked here as text
// (the behaviour was also tried in a real browser).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "..", "desktop", "com.hyadeos.desktop.html"), "utf8");

test("privacy mode has its Control Panel tile, taskbar shield and overlay", () => {
  assert.match(html, /id="tilePrivacy" onclick="togglePrivacyMode\(\)"/);
  assert.match(html, /id="trayPrivacy"/);
  assert.match(html, /id="privacyShield"/);
  assert.match(html, /data-i18n="desktop\.privacy\.title"/);
  assert.match(html, /function togglePrivacyMode\(/);
  assert.match(html, /function privateText\(/);
  assert.match(html, /body\.privacy-mode \.popup:not\(\.focused\)::after/);
  assert.match(html, /hyadeOSElectron\?\.setPrivacy\?\./);
});

test("notifications can opt out of privacy mode with showInPrivacy", () => {
  assert.match(html, /options && options\.showInPrivacy/);
  assert.match(html, /privateText\(document\.createElement\('div'\), n\.msg, n\.showInPrivacy\)/);
});

test("Alt+Tab switcher is wired to the launcher and to the page keyboard", () => {
  assert.match(html, /id="winSwitcher"/);
  assert.match(html, /function handleSwitcher\(/);
  assert.match(html, /hyadeOSElectron\?\.onShellSwitcher\?\.\(handleSwitcher\)/);
  assert.match(html, /e\.altKey && e\.key === 'Tab'/);
  assert.match(html, /noteWindowUse\(popup\);/);
  assert.match(html, /!id\.startsWith\('dialog_'\)/);
});
