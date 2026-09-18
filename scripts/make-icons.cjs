/* Renders public/icon.svg to the PNG sizes a web app manifest needs, and
   public/og.svg to the share card links unfurl into.
   Run by hand — `npx electron scripts/make-icons.cjs` — whenever the SVG
   changes; the PNGs are committed so neither CI nor a contributor needs an
   image toolchain to build the app. Electron is already a dev dependency and
   is the browser engine the icons will be displayed by, so it renders them
   exactly as they will appear. */
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const SIZE = 512;
// sources live outside public/ so the artwork the build is made *from* isn't
// published alongside it; only the rendered PNGs (and the favicon) are served
const src = path.join(__dirname, "..", "design");
const pub = path.join(__dirname, "..", "public");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loml-icons-"));
const jobs = [
  { svg: "icon.svg", out: { "icon-512.png": 512, "icon-192.png": 192, "../public/icon.svg": "copy" } },
  { svg: "icon-maskable.svg", out: { "icon-maskable-512.png": 512 } },
  // the size every link preview expects; anything else gets cropped by someone
  { svg: "og.svg", out: { "og.png": null }, width: 1200, height: 630 },
];

/* One window, loaded from a file rather than a data: URL — a second data: load
   in the same run fails with ERR_FAILED. Everything is drawn at 512 and scaled
   down from there, so the small icon is a resample of the same render rather
   than a second, subtly different one. */
async function render(win, { svg, out, width = SIZE, height = SIZE }) {
  const markup = fs.readFileSync(path.join(src, svg), "utf8").replace(/width="\d+" height="\d+"/, "");
  const page = path.join(tmp, `${svg}.html`);
  /* The page is painted the app's own background: the capture can overshoot the
     div by a pixel, and the rounded corners of icon.svg let the page through —
     either way what shows must be the icon's ground, not white. The share card
     also wants the app's real display face, which only a webfont provides. */
  fs.writeFileSync(page, `<!doctype html><html><head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=IBM+Plex+Mono:wght@500&family=Inter:wght@400;600&display=swap">
    </head><body style="margin:0;background:#171C18;overflow:hidden">
    <div style="width:${width}px;height:${height}px">${markup}</div></body></html>`);
  win.setContentSize(width, height);
  await win.loadFile(page);
  // the faces have to have arrived before the capture, or it bakes in the fallback
  await win.webContents.executeJavaScript("document.fonts.ready").catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  const img = await win.capturePage({ x: 0, y: 0, width, height });
  for (const [name, size] of Object.entries(out)) {
    // the favicon is served as the SVG itself, so it is copied rather than rendered
    if (size === "copy") { fs.copyFileSync(path.join(src, svg), path.join(pub, name)); console.log(`${name}  (copied)`); continue; }
    const scaled = size === null || size === width ? img : img.resize({ width: size, height: size, quality: "best" });
    fs.writeFileSync(path.join(pub, name), scaled.toPNG());
    console.log(`${name}  ${size === null ? `${width}x${height}` : `${size}x${size}`}`);
  }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: SIZE, height: SIZE, useContentSize: true, show: false });
  for (const job of jobs) await render(win, job);
  win.destroy();
  fs.rmSync(tmp, { recursive: true, force: true });
  app.quit();
});
