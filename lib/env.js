// hyadeOS environment variables: HYADEOS_PORT, HYADEOS_NODE_EXECUTABLE, HYADEOS_MAIL_RELAY_URL...
//
// The project used to be spelled "hyadeOSS", so the same variables with the old prefix
// (HYADEOSS_PORT...) may still be set: by an installer, by a .env file, or by an older launcher.
// An update restarts the kernel before the launcher, so for a moment a new server.js runs under an
// old launcher that only knows the old names. The old prefix is therefore still read, as a fallback.
// It can be dropped once nobody runs a launcher from before the rename.

const LEGACY_PREFIX = "HYADEOSS_";
const PREFIX = "HYADEOS_";

// envVar("PORT") -> HYADEOS_PORT, else the legacy HYADEOSS_PORT, else undefined. Empty counts as unset.
function envVar(name, env = process.env) {
  const current = env[PREFIX + name];
  if (current !== undefined && current !== "") return current;
  const legacy = env[LEGACY_PREFIX + name];
  return legacy !== undefined && legacy !== "" ? legacy : undefined;
}

// The same variable under both names, for a child process that may be older or newer than this one.
function envPair(name, value) {
  return { [PREFIX + name]: value, [LEGACY_PREFIX + name]: value };
}

module.exports = { envVar, envPair };
