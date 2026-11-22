// Names from before the rename (the project was spelled "hyadeOSS"), kept so installs and apps made back
// then keep working. Everything here can go once nobody runs a version from before the rename.

// The Tiles desktop was copied to desktop/ under the old prefix by installs from before the rename.
const LEGACY_TWM_FILE = "com.hyadeoss.twm.html";

// A secondary desktop installed under the old prefix. The old copies of the core pages (desktop, login, lock
// screen) are left over from before an update and must not be listed.
const LEGACY_SECONDARY_DESKTOP = /^com\.hyadeoss\.(?!desktop\.|loginui\.|lockscreen\.)[^.]+\.html$/;

// Which files in desktop/ the desktop picker offers.
function isListedDesktop(file) {
  return file.endsWith(".html") && !file.includes("loginui") &&
    (file.startsWith("com.hyadeos.") || LEGACY_SECONDARY_DESKTOP.test(file));
}

module.exports = { LEGACY_TWM_FILE, LEGACY_SECONDARY_DESKTOP, isListedDesktop };
