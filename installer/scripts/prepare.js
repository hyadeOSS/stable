// Prepares the installer build: copies the system (this repository without .git, .github, test and installer: exactly
// what the 2.0.4 installer bundled) into installer/system, and makes the installer's version follow system/version.json,
// so the number cannot be forgotten: the installer only replaces the copy on a PC when its version is newer.
const fs = require("fs");
const path = require("path");

const repository = path.resolve(__dirname, "..", "..");
const installer = path.resolve(__dirname, "..");
const destination = path.join(installer, "system");
const SKIP = new Set([".git", ".github", "test", "installer"]); // top level only

fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
let copied = 0;
for (const name of fs.readdirSync(repository)) {
  if (SKIP.has(name)) continue;
  fs.cpSync(path.join(repository, name), path.join(destination, name), { recursive: true });
  copied++;
}

const system = JSON.parse(fs.readFileSync(path.join(destination, "version.json"), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(String(system.version))) throw new Error(`system/version.json has "${system.version}": a stable installer needs X.Y.Z`);
for (const required of ["server.js", "launcher.js", "preload.js", "boot.html", "package.json", "node_modules/express/package.json"]) {
  if (!fs.existsSync(path.join(destination, required))) throw new Error(`the system to bundle lacks ${required}`);
}
const packagePath = path.join(installer, "package.json");
const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.version = system.version;
fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
console.log(`system ${system.version} prepared: ${copied} top-level entries copied to installer/system`);
