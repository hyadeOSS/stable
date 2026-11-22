// Copies the prepared system (installer/system) into the app as resources/system, file for file.
// Why not `extraResources`: electron-builder leaves node_modules out of extra resources whatever the filter says,
// and the kernel needs its 933 files (the 2.0.4 installer bundled them).
const fs = require("fs");
const path = require("path");

exports.default = async function afterPack(context) {
  const from = path.join(__dirname, "..", "system");
  const to = path.join(context.appOutDir, "resources", "system");
  if (!fs.existsSync(path.join(from, "server.js"))) throw new Error("installer/system is not prepared: run scripts/prepare.js first");
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  const count = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? count(path.join(dir, e.name)) : 1), 0);
  const expected = count(from), copied = count(to);
  if (copied !== expected) throw new Error(`resources/system has ${copied} files, expected ${expected}`);
  console.log(`  • system bundled  files=${copied}`);
};
