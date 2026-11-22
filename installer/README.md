# Windows installer

The installer (`hyadeOS.Setup.<version>.exe`) is built here. Its project used to be in no repository; the settings were read back
from `hyadeOSS.Setup.2.0.4.exe`.

| File | What it is |
| --- | --- |
| `main.js` | the installed app's entry point (goes in `app.asar`): copies the system to `%APPDATA%\hyadeOS\system`, migrates the data from `%APPDATA%\hyadeOSS`, starts `launcher.js` |
| `package.json` | the app's name, `productName` and version; the version is set from `../version.json` by `scripts/prepare.js` |
| `electron-builder.yml` | the build settings; **`appId` and `nsis.guid` stay as they are**: they make the installer update an existing installation in place |
| `scripts/prepare.js` | copies the repository (without `.git`, `.github`, `test`, `installer`) into `installer/system` |
| `scripts/after-pack.js` | puts that copy into the app as `resources/system`, file for file (electron-builder alone would drop `node_modules`) |
| `scripts/smoke-upgrade.ps1` | the test on Windows: installs 2.0.4, then the new installer on top, and checks one entry, data kept, kernel started, clean uninstall |
| `test/main.test.js` | tests of `main.js` (version order, data migration, environment): `npm test` |
| `RELEASE-NOTES.md` | the notes of the release (update them with each release) |

## Make an installer
1. Raise `version` in `../version.json` (and merge): the installer replaces the system copy on a PC **only if its version is newer** than the installed one.
2. GitHub › Actions › *Build installer* › *Run workflow*. Tick *draft_release* to attach it to a **draft** release `v<version>`; try it, then publish.
   (A pull request that touches `installer/` builds and tests it too; a pushed tag `v*` does the same and drafts the release.)
3. The workflow only drafts: publishing the release is yours.

Locally (Windows): `cd installer && npm ci && npm run dist` (the file lands in `installer/dist`).

## Not covered
The installer is **not code signed**: Windows SmartScreen may warn on first run. A signing certificate can be added to the build later.
