/* Renders public/icon.svg to the PNG sizes a web app manifest needs.
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
const pub = path.join(__dirname, "..", "public");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "loml-icons-"));
const jobs = [
  { svg: "icon.svg", out: { "icon-512.png": 512, "icon-192.png": 192 } },
  { svg: "icon-maskable.svg", out: { "icon-maskable-512.png": 512 } },
];

/* One window, loaded from a file rather than a data: URL — a second data: load
   in the same run fails with ERR_FAILED. Everything is drawn at 512 and scaled
   down from there, so the small icon is a resample of the same render rather
   than a second, subtly different one. */
async function render(win, { svg, out }) {
  const markup = fs.readFileSync(path.join(pub, svg), "utf8").replace(/width="512" height="512"/, "");
  const page = path.join(tmp, `${svg}.html`);
  /* The page is painted the app's own background: the capture can overshoot the
     div by a pixel, and the rounded corners of icon.svg let the page through —
     either way what shows must be the icon's ground, not white. */
  fs.writeFileSync(page, `<!doctype html><html><body style="margin:0;background:#171C18;overflow:hidden">
    <div style="width:${SIZE}px;height:${SIZE}px">${markup}</div></body></html>`);
  await win.loadFile(page);
  await new Promise((r) => setTimeout(r, 200)); // let the first frame paint
  const img = await win.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE });
  for (const [name, size] of Object.entries(out)) {
    const scaled = size === SIZE ? img : img.resize({ width: size, height: size, quality: "best" });
    fs.writeFileSync(path.join(pub, name), scaled.toPNG());
    console.log(`${name}  ${size}x${size}`);
  }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: SIZE, height: SIZE, useContentSize: true, show: false });
  for (const job of jobs) await render(win, job);
  win.destroy();
  fs.rmSync(tmp, { recursive: true, force: true });
  app.quit();
});
