// Run: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const S = require("../desktop/assets/browser-sidebar-state.js");

const page = (n) => ({ url: `https://example${n}.com/`, title: `Example ${n}`, favicon: null });

test("default-state", () => {
  const state = S.load(null, null);
  assert.equal(state.version, 1);
  assert.equal(state.spaces.length, 1);
  assert.equal(state.spaces[0].name, "Personal");
  assert.equal(state.spaces[0].color, "#4263eb");
  assert.equal(state.currentSpace, state.spaces[0].id);
  assert.equal(state.sidebarWidth, 250);
  assert.equal(state.collapsed, false);
  assert.deepEqual(state.favorites, []);
});

test("legacy-theme-color", () => {
  assert.equal(S.load(null, "#e64980").spaces[0].color, "#e64980");
  assert.equal(S.load(null, "accent").spaces[0].color, "#4263eb");
  assert.equal(S.load(null, "default").spaces[0].color, "#4263eb");
});

test("load-recovers-from-garbage", () => {
  for (const raw of ["{", "[]", '{"version":9}', '{"version":1,"spaces":"x"}', '{"version":1,"spaces":[]}', "null", "42"]) {
    const state = S.load(raw, null);
    assert.equal(state.spaces.length, 1, raw);
    assert.equal(state.spaces[0].name, "Personal", raw);
  }
});

test("load-drops-invalid-items", () => {
  const raw = JSON.stringify({ version: 1, favorites: [{ id: "a", url: "javascript:alert(1)" }, { id: "b", url: "https://ok.com/" }, "junk"],
    spaces: [{ id: "s", name: "Work", color: "#2f9e44", pinned: [{ id: "c", url: "file:///etc" }], today: [{ id: "d", url: "http://x.org/" }] }], currentSpace: "missing" });
  const state = S.load(raw, null);
  assert.deepEqual(state.favorites.map(i => i.id), ["b"]);
  assert.deepEqual(state.spaces[0].pinned, []);
  assert.deepEqual(state.spaces[0].today.map(i => i.id), ["d"]);
  assert.equal(state.currentSpace, "s");
});

test("roundtrip", () => {
  const state = S.load(null, null);
  const space = S.addSpace(state, "Work", "#2f9e44");
  S.addToday(state, space.id, page(1));
  const fav = S.addToday(state, space.id, page(2));
  S.moveItem(state, fav.id, { section: "favorites", index: 0 });
  assert.deepEqual(S.load(S.serialize(state), null), state);
});

test("add-today-goes-first", () => {
  const state = S.load(null, null);
  const id = state.currentSpace;
  const a = S.addToday(state, id, page(1));
  const b = S.addToday(state, id, page(2));
  assert.deepEqual(S.currentSpace(state).today.map(i => i.id), [b.id, a.id]);
  assert.notEqual(a.id, b.id);
});

test("move-to-favorites-sets-savedUrl", () => {
  const state = S.load(null, null);
  const item = S.addToday(state, state.currentSpace, page(1));
  S.moveItem(state, item.id, { section: "favorites", index: 0 });
  const found = S.findItem(state, item.id);
  assert.equal(found.section, "favorites");
  assert.equal(found.space, null);
  assert.equal(found.item.savedUrl, "https://example1.com/");
  assert.deepEqual(S.currentSpace(state).today, []);
  S.updateItem(state, item.id, { url: "https://example1.com/other" });
  assert.equal(found.item.savedUrl, "https://example1.com/");
});

test("move-out-of-favorites-drops-savedUrl", () => {
  const state = S.load(null, null);
  const item = S.addToday(state, state.currentSpace, page(1));
  S.moveItem(state, item.id, { section: "favorites", index: 0 });
  S.moveItem(state, item.id, { section: "pinned", spaceId: state.currentSpace, index: 0 });
  const found = S.findItem(state, item.id);
  assert.equal(found.section, "pinned");
  assert.equal("savedUrl" in found.item, false);
});

test("move-reorders-within-section", () => {
  const state = S.load(null, null);
  const id = state.currentSpace;
  const a = S.addToday(state, id, page(1)), b = S.addToday(state, id, page(2)), c = S.addToday(state, id, page(3));
  S.moveItem(state, c.id, { section: "today", spaceId: id, index: 2 });
  assert.deepEqual(S.currentSpace(state).today.map(i => i.id), [b.id, a.id, c.id]);
});

test("drag-index-measured-before-removal", () => {
  const state = S.load(null, null);
  const id = state.currentSpace;
  const a = S.addToday(state, id, page(1)), b = S.addToday(state, id, page(2)), c = S.addToday(state, id, page(3));
  // [c, b, a]: drag c below a (slot 3 in the old list) -> [b, a, c]
  S.moveItem(state, c.id, { section: "today", spaceId: id, index: 3, adjust: true });
  assert.deepEqual(S.currentSpace(state).today.map(i => i.id), [b.id, a.id, c.id]);
  // drag a above b (slot 0) -> [a, b, c]
  S.moveItem(state, a.id, { section: "today", spaceId: id, index: 0, adjust: true });
  assert.deepEqual(S.currentSpace(state).today.map(i => i.id), [a.id, b.id, c.id]);
});

test("remove-last-space-refused", () => {
  const state = S.load(null, null);
  assert.equal(S.removeSpace(state, state.currentSpace), false);
  assert.equal(state.spaces.length, 1);
});

test("remove-current-space-switches", () => {
  const state = S.load(null, null);
  const first = state.currentSpace;
  const work = S.addSpace(state, "Work", "#2f9e44");
  state.currentSpace = work.id;
  assert.equal(S.removeSpace(state, work.id), true);
  assert.equal(state.currentSpace, first);
});

test("update-space", () => {
  const state = S.load(null, null);
  S.updateSpace(state, state.currentSpace, { name: "  Home  ", color: "#9c36b5" });
  assert.equal(S.currentSpace(state).name, "Home");
  assert.equal(S.currentSpace(state).color, "#9c36b5");
  S.updateSpace(state, state.currentSpace, { name: "   ", color: "red" });
  assert.equal(S.currentSpace(state).name, "Home");
  assert.equal(S.currentSpace(state).color, "#9c36b5");
});

test("clear-today", () => {
  const state = S.load(null, null);
  const id = state.currentSpace;
  S.addToday(state, id, page(1));
  S.addToday(state, id, page(2));
  const removed = S.clearToday(state, id);
  assert.equal(removed.length, 2);
  assert.deepEqual(S.currentSpace(state).today, []);
});

test("remove-item", () => {
  const state = S.load(null, null);
  const item = S.addToday(state, state.currentSpace, page(1));
  assert.equal(S.removeItem(state, item.id).id, item.id);
  assert.equal(S.findItem(state, item.id), null);
  assert.equal(S.removeItem(state, "nope"), null);
});

test("new-tab-marker-survives", () => {
  const state = S.load(null, null);
  const blank = S.addToday(state, state.currentSpace, { url: "about:blank", title: "", favicon: null });
  assert.equal(blank.url, S.NEW_TAB);
  const back = S.load(S.serialize(state), null);
  assert.equal(S.currentSpace(back).today[0].url, "hyade:newtab");
});

test("width-clamped", () => {
  assert.equal(S.load(JSON.stringify({ version: 1, spaces: [{ id: "s", name: "A", color: "#000000" }], sidebarWidth: 900 }), null).sidebarWidth, 360);
  assert.equal(S.load(JSON.stringify({ version: 1, spaces: [{ id: "s", name: "A", color: "#000000" }], sidebarWidth: 10 }), null).sidebarWidth, 200);
});
