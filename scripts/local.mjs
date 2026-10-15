#!/usr/bin/env node
// Abre o NeuroPlanner SÓ neste computador: o servidor escuta apenas 127.0.0.1 (nenhum outro aparelho,
// nem na mesma rede Wi-Fi, consegue se conectar) e os dados continuam criptografados no navegador.
// Uso: npm run local   (ou os atalhos Abrir-NeuroPlanner.bat / Abrir-NeuroPlanner.command)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const PORT = Number(process.env.PORT) || 3000;
const URL_LOCAL = `http://localhost:${PORT}`;
const isWin = process.platform === "win32";

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`\nNode.js ${process.versions.node} é antigo. Instale o Node.js 22 (LTS) em https://nodejs.org e abra de novo.\n`);
  process.exit(1);
}

function run(cmd, args, label) {
  console.log(`\n→ ${label}…`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: isWin, env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
  if (r.status !== 0) {
    console.error(`\nNão foi possível ${label.toLowerCase()}. Veja a mensagem acima.\n`);
    process.exit(r.status ?? 1);
  }
}

// Data da alteração mais recente do código (para saber se é preciso compilar de novo)
function newest(dir) {
  let t = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    t = Math.max(t, s.isDirectory() ? newest(p) : s.mtimeMs);
  }
  return t;
}

const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
if (!existsSync(nextBin)) run(isWin ? "npm.cmd" : "npm", ["ci", "--no-audit", "--no-fund"], "Instalar as dependências (só na primeira vez)");

const stampFile = join(root, ".next", "local-build-stamp");
const codeTime = String(Math.max(newest(join(root, "src")), statSync(join(root, "package-lock.json")).mtimeMs));
const built = existsSync(join(root, ".next", "BUILD_ID")) && existsSync(stampFile) && readFileSync(stampFile, "utf8") === codeTime;
if (!built) {
  run(process.execPath, [nextBin, "build"], "Preparar o sistema (leva alguns minutos na primeira vez)");
  writeFileSync(stampFile, codeTime);
}

console.log(`\nNeuroPlanner aberto só neste computador: ${URL_LOCAL}\nPara fechar, feche esta janela (ou Ctrl+C).\n`);
const server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(PORT)], {
  stdio: "inherit",
  env: { ...process.env, LOCAL_ONLY: "1", NEXT_TELEMETRY_DISABLED: "1" },
});
setTimeout(() => {
  const opener = isWin ? ["cmd", ["/c", "start", "", URL_LOCAL]] : process.platform === "darwin" ? ["open", [URL_LOCAL]] : ["xdg-open", [URL_LOCAL]];
  try {
    const child = spawn(opener[0], opener[1], { stdio: "ignore", detached: true });
    child.on("error", () => console.log(`Abra no navegador: ${URL_LOCAL}`));
    child.unref();
  } catch {
    console.log(`Abra no navegador: ${URL_LOCAL}`);
  }
}, 2500);
server.on("exit", (code) => process.exit(code ?? 0));
