// hyadeOS - background photo for the Browser's new tab page.
// (C) 2026 mariowstech and the hyadeOS team - Licensed under the Apache License, Version 2.0
//
// Picks a random photo from Bing's recent "image of the day" list. The list is fetched by the
// server (the page itself may only talk to this server) and kept for a few hours; the photo is
// then loaded straight from bing.com by the page.
//
// The route needs no login: the new tab page runs in the browser's own session, which doesn't
// carry the hyadeOS session cookie, and the answer holds nothing private (a public photo URL).

const LIST_URL = "https://www.bing.com/HPImageArchive.aspx?format=js&idx=0&n=8&mkt=en-US";
const CACHE_MS = 6 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 5 * 60 * 1000;

let cache = { images: [], until: 0 };
let pending = null;

function toPhoto(image) {
  if (!image || typeof image.url !== "string" || !image.url.startsWith("/th?id=")) return null;
  return {
    url: "https://www.bing.com" + image.url,
    title: String(image.title || "").slice(0, 200),
    credit: String(image.copyright || "").slice(0, 300),
    link: typeof image.copyrightlink === "string" && /^https:\/\//.test(image.copyrightlink) ? image.copyrightlink : null,
  };
}

async function loadList() {
  const response = await fetch(LIST_URL, { headers: { "User-Agent": "hyadeOS/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Bing answered ${response.status}`);
  const data = await response.json();
  const images = (Array.isArray(data.images) ? data.images : []).map(toPhoto).filter(Boolean);
  if (!images.length) throw new Error("Bing sent no images");
  return images;
}

async function getImages() {
  if (Date.now() < cache.until) return cache.images;
  if (!pending) {
    pending = loadList()
      .then(images => { cache = { images, until: Date.now() + CACHE_MS }; })
      // Offline or blocked: keep any older list, and don't ask again on every new tab.
      .catch(() => { cache = { images: cache.images, until: Date.now() + FAILURE_RETRY_MS }; })
      .finally(() => { pending = null; });
  }
  await pending;
  return cache.images;
}

function registerBrowserWallpaperRoute(app) {
  app.get("/api/browser/wallpaper", async (req, res) => {
    const images = await getImages();
    res.setHeader("Cache-Control", "no-store");
    if (!images.length) return res.status(503).json({ success: false });
    res.json({ success: true, ...images[Math.floor(Math.random() * images.length)] });
  });
}

module.exports = { registerBrowserWallpaperRoute, _toPhoto: toPhoto };
