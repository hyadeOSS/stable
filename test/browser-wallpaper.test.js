// Run: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const { _toPhoto } = require("../lib/browser-wallpaper.js");

test("bing-image-becomes-photo", () => {
  const photo = _toPhoto({ url: "/th?id=OHR.Lake_EN-US123_1920x1080.jpg&rf=x", title: "Lake", copyright: "Lake, Canada (© Someone)", copyrightlink: "https://www.bing.com/search?q=lake" });
  assert.equal(photo.url, "https://www.bing.com/th?id=OHR.Lake_EN-US123_1920x1080.jpg&rf=x");
  assert.equal(photo.title, "Lake");
  assert.equal(photo.credit, "Lake, Canada (© Someone)");
  assert.equal(photo.link, "https://www.bing.com/search?q=lake");
});

test("bing-image-rejects-other-hosts", () => {
  assert.equal(_toPhoto({ url: "https://evil.example/x.jpg" }), null);
  assert.equal(_toPhoto({ url: "//evil.example/th?id=x" }), null);
  assert.equal(_toPhoto(null), null);
  assert.equal(_toPhoto({ url: "/th?id=x", copyrightlink: "javascript:alert(1)" }).link, null);
});
