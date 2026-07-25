// Prepara o servidor de PO token (bgutil-ytdlp-pot-provider), necessario
// pro yt-dlp nao ser bloqueado como bot pelo YouTube. Clona, instala e
// compila uma vez em vendor/bgutil-ytdlp-pot-provider; nas proximas
// execucoes so confere se o build ja existe.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const vendorDir = path.join(projectRoot, "vendor", "bgutil-ytdlp-pot-provider");
const serverDir = path.join(vendorDir, "server");
const buildEntry = path.join(serverDir, "build", "main.js");

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      windowsHide: true,
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} saiu com codigo ${code}`));
    });
  });
}

export async function ensurePotServer() {
  if (existsSync(buildEntry)) {
    return buildEntry;
  }

  console.log("Preparando o servidor de PO token (so acontece na primeira vez)...");

  if (!existsSync(vendorDir)) {
    await run("git", [
      "clone",
      "--depth",
      "1",
      "https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git",
      vendorDir,
    ], projectRoot);
  }

  await run("npm", ["install"], serverDir);
  await run("npx", ["tsc"], serverDir);

  if (!existsSync(buildEntry)) {
    throw new Error("Falha ao compilar o servidor de PO token.");
  }

  return buildEntry;
}
