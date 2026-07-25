// Launcher unico do app: prepara e sobe o servidor de PO token, builda o
// Next.js se preciso, sobe o servidor de producao e abre o Chrome na
// interface. E o script que roda quando o usuario "abre o app".
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ensurePotServer } from "./setup-pot-server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");

const POT_SERVER_PORT = 4416;
const APP_PORT = process.env.PORT || 3000;
const APP_URL = `http://localhost:${APP_PORT}`;

function spawnDetached(command, args, options = {}) {
  return spawn(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
    windowsHide: true,
    shell: process.platform === "win32",
    ...options,
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnDetached(command, args);
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} saiu com codigo ${code}`));
    });
  });
}

async function waitForPort(url, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // ainda subindo, tenta de novo
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

function openInChrome(url) {
  if (process.platform === "win32") {
    spawn("cmd.exe", ["/c", "start", "", "chrome", url], {
      windowsHide: true,
      detached: true,
      stdio: "ignore",
    }).unref();
  } else if (process.platform === "darwin") {
    spawn("open", ["-a", "Google Chrome", url], {
      detached: true,
      stdio: "ignore",
    }).unref();
  } else {
    spawn("google-chrome", [url], { detached: true, stdio: "ignore" }).unref();
  }
}

async function main() {
  const potServerEntry = await ensurePotServer();

  console.log("Subindo o servidor de PO token...");
  const potServer = spawnDetached("node", [potServerEntry]);

  const potReady = await waitForPort(
    `http://127.0.0.1:${POT_SERVER_PORT}/ping`,
    20_000,
  );
  if (!potReady) {
    console.warn(
      "O servidor de PO token nao respondeu a tempo. O download pode falhar " +
        "com bloqueio de bot do YouTube.",
    );
  }

  const buildExists = existsSync(path.join(projectRoot, ".next", "BUILD_ID"));
  if (!buildExists) {
    console.log("Primeira execucao: buildando a interface...");
    await run("npm", ["run", "build"]);
  }

  console.log("Subindo o servidor da interface...");
  const nextServer = spawnDetached("npm", ["run", "start", "--", "-p", String(APP_PORT)]);

  const appReady = await waitForPort(APP_URL, 30_000);
  if (appReady) {
    openInChrome(APP_URL);
  } else {
    console.error("A interface nao respondeu a tempo em " + APP_URL);
  }

  const shutdown = () => {
    potServer.kill();
    nextServer.kill();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
