// Loaded first in every ACode preview page (/acode-preview/...): reports the page's runtime
// errors, failed loads and console errors/warnings to ACode and to the Terminal's
// `acode run`, which listen on the "acode-runtime" channel. It only reports: nothing in
// the page changes, and the console still prints everything as usual.
(() => {
  let channel;
  try { channel = new BroadcastChannel("acode-runtime"); } catch (error) { return; }
  const send = (kind, message, file, line, col) => {
    try {
      channel.postMessage({ kind, message: String(message || ""), file: file || location.href, line: line || 0, col: col || 0, page: location.pathname, at: Date.now() });
    } catch (error) {}
  };
  const describe = value => {
    if (value instanceof Error) return `${value.name}: ${value.message}`;
    if (typeof value === "string") return value;
    try { return JSON.stringify(value); } catch (error) { return String(value); }
  };
  // Where a console call came from: the first stack frame outside this file.
  const caller = () => {
    const frames = String(new Error().stack || "").split("\n").slice(1);
    for (const frame of frames) {
      const match = frame.match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/);
      if (match && !match[1].includes("acode-preview-reporter.js")) return { file: match[1], line: +match[2], col: +match[3] };
    }
    return {};
  };

  send("load", "", location.href, 0, 0);
  addEventListener("error", event => {
    const target = event.target;
    if (target && target !== window && (target.src || target.href)) {
      send("resource", `Failed to load ${target.tagName.toLowerCase()} "${target.getAttribute("src") || target.getAttribute("href")}"`, location.href, 0, 0);
      return;
    }
    send("error", event.message || describe(event.error), event.filename, event.lineno, event.colno);
  }, true);
  addEventListener("unhandledrejection", event => {
    const from = event.reason && event.reason.stack ? (String(event.reason.stack).match(/(https?:\/\/[^\s)]+):(\d+):(\d+)/) || []) : [];
    send("rejection", `Unhandled promise rejection: ${describe(event.reason)}`, from[1], +from[2] || 0, +from[3] || 0);
  });
  for (const level of ["error", "warn"]) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      const where = caller();
      send(level === "error" ? "console-error" : "console-warn", args.map(describe).join(" "), where.file, where.line, where.col);
    };
  }
})();
