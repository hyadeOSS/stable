// Store catalog sources ("channels") and sideload helpers, split out of server.js so the
// pure logic can be unit-tested without booting the kernel.
//
// The Store reads two catalogs. "stable" is always on; "insiders" is an opt-in source of
// early builds. Sources are additive: an app can be stable-only, insiders-only, or exist in
// both, and then the user picks one build ("variant") at install.

const fs = require("fs");
const path = require("path");

const STORE_CHANNELS = ["stable", "insiders"];

const storeChannel = value => (value === "insiders" ? "insiders" : "stable");

// One build of an app as offered by one source. The catalog is untrusted data: only known
// fields are copied, and only strings/arrays of strings survive.
function catalogVariant(channel, entry) {
  const variant = { channel, repoUrl: entry.repoUrl };
  if (entry.eula) variant.eula = entry.eula;
  if (entry.desc) variant.desc = entry.desc;
  if (entry.version) variant.version = String(entry.version);
  if (Array.isArray(entry.screenshots)) variant.screenshots = entry.screenshots.filter(url => typeof url === "string");
  return variant;
}

// One list of apps, each with the builds the enabled sources offer. Top-level
// repoUrl/eula stay the default build, so older clients keep working unchanged.
// A stable entry may also carry an inline `insiders: { repoUrl, eula, desc }`.
function buildStoreCatalog(stable, insiders) {
  const apps = new Map();
  for (const entry of stable || []) {
    const { insiders: inline, ...rest } = entry;
    const item = { ...rest, variants: [catalogVariant("stable", entry)] };
    if (inline && insiders && typeof inline.repoUrl === "string") {
      item.variants.push(catalogVariant("insiders", { ...entry, eula: null, desc: null, version: null, screenshots: null, ...inline }));
    }
    apps.set(entry.id, item);
  }
  for (const entry of insiders || []) {
    const existing = apps.get(entry.id);
    if (existing) {
      existing.variants = existing.variants.filter(variant => variant.channel !== "insiders");
      existing.variants.push(catalogVariant("insiders", entry));
    } else {
      const { insiders: _ignored, ...rest } = entry;
      apps.set(entry.id, { ...rest, variants: [catalogVariant("insiders", entry)] });
    }
  }
  return [...apps.values()].map(app => ({
    ...app,
    channels: app.variants.map(variant => variant.channel),
    insidersOnly: app.variants.every(variant => variant.channel === "insiders")
  }));
}

// A sideload source must be inside the administrator's home partition ("/home" or "/home/...").
function isHomeVirtualPath(virtualPath) {
  return typeof virtualPath === "string" && (virtualPath === "/home" || virtualPath.startsWith("/home/"));
}

// True when `target` is `base` or lives under it (both already resolved/real paths).
function isInside(base, target) {
  return target === base || target.startsWith(base + path.sep);
}

// Copy filter for sideloading a folder: no .git / node_modules and, above all, no symbolic
// links (a link in the source could point at files outside the home and be served later).
function sideloadCopyFilter(source) {
  if (/[\\/](\.git|node_modules)([\\/]|$)/.test(source)) return false;
  try { return !fs.lstatSync(source).isSymbolicLink(); } catch (e) { return false; }
}

// Title and icon come from the request: trim, cap and ignore anything that is not a string.
function sideloadLabels(appId, { title, icon } = {}) {
  const cleanTitle = typeof title === "string" && title.trim() ? title.trim().slice(0, 80) : appId;
  const cleanIcon = typeof icon === "string" && icon.trim() ? icon.trim().slice(0, 300) : "";
  return { title: cleanTitle, icon: cleanIcon };
}

module.exports = { STORE_CHANNELS, storeChannel, catalogVariant, buildStoreCatalog, isHomeVirtualPath, isInside, sideloadCopyFilter, sideloadLabels };
