// hyadeOS Browser: saved favorites, spaces, pinned and today's tabs.
// Pure data, no DOM: the desktop renders the sidebar from this and saves serialize() in localStorage.
// Tests: system/tests/browser-sidebar-state.test.js (node --test system/tests/).
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BrowserSidebarState = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VERSION = 1;
  const DEFAULT_COLOR = "#4263eb";
  const WIDTH = { min: 200, max: 360, default: 250 };
  const HEX = /^#[0-9a-f]{6}$/i;

  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  // The new-tab page is saved as NEW_TAB: its real address carries the port, which can change.
  const NEW_TAB = "hyade:newtab";
  const isWebUrl = (url) => typeof url === "string" && (/^https?:\/\//i.test(url) || url === NEW_TAB);
  const text = (value, max = 300) => (typeof value === "string" ? value.slice(0, max) : "");

  function cleanItem(raw, favorite) {
    if (!raw || typeof raw !== "object" || !isWebUrl(raw.url)) return null;
    const item = { id: typeof raw.id === "string" && raw.id ? raw.id : newId(), url: raw.url, title: text(raw.title), favicon: isWebUrl(raw.favicon) || /^data:image\//i.test(raw.favicon || "") ? raw.favicon : null };
    if (favorite) item.savedUrl = isWebUrl(raw.savedUrl) ? raw.savedUrl : raw.url;
    return item;
  }

  const cleanItems = (list, favorite) => (Array.isArray(list) ? list.map((i) => cleanItem(i, favorite)).filter(Boolean) : []);

  function cleanSpace(raw) {
    if (!raw || typeof raw !== "object") return null;
    const name = text(raw.name, 40).trim();
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : newId(),
      name: name || "Space",
      color: HEX.test(raw.color) ? raw.color : DEFAULT_COLOR,
      pinned: cleanItems(raw.pinned, false),
      today: cleanItems(raw.today, false),
    };
  }

  function makeSpace(name, color) {
    return { id: newId(), name, color: HEX.test(color) ? color : DEFAULT_COLOR, pinned: [], today: [] };
  }

  function createDefault(legacyTheme) {
    const space = makeSpace("Personal", HEX.test(legacyTheme || "") ? legacyTheme : DEFAULT_COLOR);
    return { version: VERSION, favorites: [], spaces: [space], currentSpace: space.id, sidebarWidth: WIDTH.default, collapsed: false };
  }

  // Anything unreadable falls back to a fresh browser instead of a broken window.
  function load(rawJson, legacyTheme) {
    let data = null;
    try { data = rawJson ? JSON.parse(rawJson) : null; } catch (e) { data = null; }
    if (!data || typeof data !== "object" || Array.isArray(data) || data.version !== VERSION || !Array.isArray(data.spaces)) return createDefault(legacyTheme);
    const spaces = data.spaces.map(cleanSpace).filter(Boolean);
    if (!spaces.length) return createDefault(legacyTheme);
    const width = Number(data.sidebarWidth);
    return {
      version: VERSION,
      favorites: cleanItems(data.favorites, true),
      spaces,
      currentSpace: spaces.some((s) => s.id === data.currentSpace) ? data.currentSpace : spaces[0].id,
      sidebarWidth: Number.isFinite(width) ? Math.min(WIDTH.max, Math.max(WIDTH.min, Math.round(width))) : WIDTH.default,
      collapsed: data.collapsed === true,
    };
  }

  const serialize = (state) => JSON.stringify(state);
  const getSpace = (state, spaceId) => state.spaces.find((s) => s.id === spaceId) || null;
  const currentSpace = (state) => getSpace(state, state.currentSpace) || state.spaces[0];

  function addSpace(state, name, color) {
    const space = makeSpace(text(name, 40).trim() || "Space", color);
    state.spaces.push(space);
    return space;
  }

  // The last space stays: there is always somewhere for tabs to go.
  function removeSpace(state, spaceId) {
    if (state.spaces.length < 2) return false;
    const index = state.spaces.findIndex((s) => s.id === spaceId);
    if (index < 0) return false;
    state.spaces.splice(index, 1);
    if (state.currentSpace === spaceId) state.currentSpace = state.spaces[Math.max(0, index - 1)].id;
    return true;
  }

  function updateSpace(state, spaceId, changes) {
    const space = getSpace(state, spaceId);
    if (!space) return;
    const name = text(changes.name, 40).trim();
    if (name) space.name = name;
    if (HEX.test(changes.color || "")) space.color = changes.color;
  }

  function addToday(state, spaceId, page) {
    const space = getSpace(state, spaceId) || currentSpace(state);
    const item = { id: newId(), url: isWebUrl(page.url) ? page.url : NEW_TAB, title: text(page.title), favicon: page.favicon || null };
    space.today.unshift(item);
    return item;
  }

  function findItem(state, itemId) {
    const fav = state.favorites.find((i) => i.id === itemId);
    if (fav) return { item: fav, section: "favorites", space: null };
    for (const space of state.spaces) {
      for (const section of ["pinned", "today"]) {
        const item = space[section].find((i) => i.id === itemId);
        if (item) return { item, section, space };
      }
    }
    return null;
  }

  function listOf(state, section, spaceId) {
    if (section === "favorites") return state.favorites;
    const space = getSpace(state, spaceId);
    return space && (section === "pinned" || section === "today") ? space[section] : null;
  }

  function updateItem(state, itemId, changes) {
    const found = findItem(state, itemId);
    if (!found) return;
    if (typeof changes.url === "string") found.item.url = changes.url;
    if (typeof changes.title === "string") found.item.title = text(changes.title);
    if ("favicon" in changes) found.item.favicon = changes.favicon || null;
  }

  function removeItem(state, itemId) {
    const found = findItem(state, itemId);
    if (!found) return null;
    const list = listOf(state, found.section, found.space && found.space.id);
    list.splice(list.indexOf(found.item), 1);
    return found.item;
  }

  // Moves an item to a section (favorites / pinned / today of a space) at an index.
  // Becoming a favorite remembers its address as savedUrl; leaving favorites forgets it.
  function moveItem(state, itemId, target) {
    const found = findItem(state, itemId);
    const list = listOf(state, target.section, target.spaceId);
    if (!found || !list) return false;
    const fromList = listOf(state, found.section, found.space && found.space.id);
    const from = fromList.indexOf(found.item);
    fromList.splice(from, 1);
    // target.adjust: the index was measured before the item left its list (drag and drop).
    let index = Number.isFinite(target.index) ? target.index : list.length;
    if (target.adjust && fromList === list && from < index) index--;
    index = Math.max(0, Math.min(list.length, index));
    if (target.section === "favorites" && found.section !== "favorites") found.item.savedUrl = found.item.url;
    if (target.section !== "favorites") delete found.item.savedUrl;
    list.splice(index, 0, found.item);
    return true;
  }

  function clearToday(state, spaceId) {
    const space = getSpace(state, spaceId);
    return space ? space.today.splice(0) : [];
  }

  return { VERSION, WIDTH, DEFAULT_COLOR, NEW_TAB, load, serialize, currentSpace, getSpace, addSpace, removeSpace, updateSpace, addToday, findItem, updateItem, removeItem, moveItem, clearToday };
});
