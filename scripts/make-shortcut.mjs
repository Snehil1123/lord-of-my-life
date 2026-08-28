import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exe = path.join(root, "release", "win-unpacked", "Lord of My Life.exe");

if (!existsSync(exe)) {
  console.error(`No build found at ${exe}\nRun: npm run app:install`);
  process.exit(1);
}

const targets = [
  path.join(os.homedir(), "Desktop", "Lord of My Life.lnk"),
  path.join(
    process.env.APPDATA,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Lord of My Life.lnk"
  ),
];

// Escaped for a single-quoted PowerShell string, where '' is a literal quote.
const q = (s) => `'${s.replace(/'/g, "''")}'`;

for (const lnk of targets) {
  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      [
        `$s = (New-Object -ComObject WScript.Shell).CreateShortcut(${q(lnk)})`,
        `$s.TargetPath = ${q(exe)}`,
        `$s.WorkingDirectory = ${q(path.dirname(exe))}`,
        `$s.Description = 'Lord of My Life'`,
        `$s.Save()`,
      ].join("; "),
    ],
    { stdio: "inherit" }
  );
  console.log(`shortcut -> ${lnk}`);
}
