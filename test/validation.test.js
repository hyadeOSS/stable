const test = require("node:test");
const assert = require("node:assert/strict");
const v = require("../lib/validation");

test("isNewerVersion only offers strictly newer builds", () => {
  assert.equal(v.isNewerVersion("1.3.6", "1.3.5"), true);
  assert.equal(v.isNewerVersion("1.10.0", "1.9.9"), true);
  assert.equal(v.isNewerVersion("1.3.5", "1.3.5"), false);
  assert.equal(v.isNewerVersion("1.0.0", "1.1.0"), false, "no silent downgrade");
});

test("prereleases rank below the release", () => {
  assert.equal(v.compareVersions("1.2.0-beta", "1.2.0"), -1);
  assert.equal(v.compareVersions("1.2.0-beta.2", "1.2.0-beta.10"), -1);
  assert.equal(v.compareVersions("1.2.0", "1.2.0-rc.1"), 1);
});

test("unparseable versions fall back to 'different means newer'", () => {
  assert.equal(v.parseVersion("1.3.4.2"), null);
  assert.equal(v.isNewerVersion("1.3.5", "1.3.4.2"), true);
  assert.equal(v.isNewerVersion("1.3.4.2", "1.3.4.2"), false);
});

test("store repos are limited to https GitHub URLs", () => {
  assert.equal(v.isAllowedRepoUrl("https://github.com/owner/app"), true);
  assert.equal(v.isAllowedRepoUrl("https://raw.githubusercontent.com/owner/app/main/x"), true);
  assert.equal(v.isAllowedRepoUrl("http://github.com/owner/app"), false);
  assert.equal(v.isAllowedRepoUrl("file:///C:/Windows"), false);
  assert.equal(v.isAllowedRepoUrl("ext::sh -c touch% /tmp/pwned"), false);
  assert.equal(v.isAllowedRepoUrl("https://github.com.evil.com/owner/app"), false);
  assert.equal(v.isAllowedRepoUrl(null), false);
});

test("raw URLs are built from the repo URL", () => {
  assert.equal(v.getRawGithubUrl("https://github.com/owner/app.git"), "https://raw.githubusercontent.com/owner/app/main/icon.png");
  assert.deepEqual(v.getRepoRawUrls("https://github.com/owner/app", "version.json"), [
    "https://raw.githubusercontent.com/owner/app/main/version.json",
    "https://raw.githubusercontent.com/owner/app/master/version.json"
  ]);
  assert.deepEqual(v.getRepoRawUrls("https://example.com/x/y", "a"), []);
});

test("updates are offered when newer, or when they replace the installed version", () => {
  assert.deepEqual(v.updateOffer({ version: "1.6.0" }, "1.5.0", 50), { offered: true, reason: "newer", older: false });
  assert.deepEqual(v.updateOffer({ version: "1.5.0" }, "1.5.0", 50), { offered: false, reason: "current", older: false });
  assert.deepEqual(v.updateOffer({ version: "1.5.0" }, "2.0.0", 50), { offered: false, reason: "current", older: true }, "no silent downgrade, but it is flagged as older");
  assert.deepEqual(v.updateOffer({ version: "1.5.0", replaces: ["2.0.0"] }, "2.0.0", 50), { offered: true, reason: "replaces", older: false });
  assert.deepEqual(v.updateOffer({ version: "1.5.0", replaces: ["2.0.0"] }, "1.9.0", 50), { offered: false, reason: "current", older: true });
});

test("a staged rollout reaches only the installs inside its percentage", () => {
  assert.equal(v.updateOffer({ version: "1.6.0", rollout: 10 }, "1.5.0", 9).offered, true);
  assert.deepEqual(v.updateOffer({ version: "1.6.0", rollout: 10 }, "1.5.0", 10), { offered: false, reason: "rollout", older: false });
  assert.equal(v.updateOffer({ version: "1.6.0", rollout: 0 }, "1.5.0", 0).offered, false);
  assert.equal(v.updateOffer({ version: "1.6.0" }, "1.5.0", 99).offered, true, "no rollout field means everyone");
  const bucket = v.rolloutBucket("0123456789abcdef0123456789abcdef");
  assert.ok(bucket >= 0 && bucket < 100);
  assert.equal(v.rolloutBucket("0123456789abcdef0123456789abcdef"), bucket, "an install keeps its bucket");
});

test("a channel behind the installed version is flagged as older, so the Updater can say so", () => {
  // Stable 2.0.4 while running Beta 2.1.0-beta.2: not an update, but not "up to date" either.
  assert.equal(v.updateOffer({ version: "2.0.4" }, "2.1.0-beta.2", 0).older, true);
  assert.equal(v.updateOffer({ version: "2.0.4" }, "2.1.0-beta.2", 0).offered, false);
  assert.equal(v.updateOffer({ version: "2.1.0-beta.2" }, "2.1.0-beta.2", 0).older, false, "the same version is not older");
  assert.equal(v.updateOffer({ version: "2.1.0" }, "2.1.0-beta.2", 0).older, false, "a release is newer than its beta");
  assert.equal(v.updateOffer({ version: "2.1.0-beta.1" }, "2.1.0-beta.2", 0).older, true);
  // A version the updater cannot order (an Insiders build name) is never called older.
  assert.equal(v.updateOffer({ version: "2.5.1_DEVPREVIEW3" }, "2.1.0-beta.2", 0).older, false);
});
