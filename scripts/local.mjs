#!/usr/bin/env node
// Abre o NeuroPlanner SÓ neste computador, em HTTPS: o servidor escuta apenas o próprio computador
// (127.0.0.1 / ::1 — nenhum outro aparelho, nem na mesma rede Wi-Fi, consegue se conectar), com um
// certificado gerado aqui (scripts/local-cert.mjs). Os dados continuam criptografados no navegador.
// Uso: npm run local   (ou os atalhos Abrir-NeuroPlanner.bat / Abrir-NeuroPlanner.command)
// Sem HTTPS (se o certificado não puder ser criado): npm run local -- --http
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:https";
import { createRequire } from "node:module";
import { ensureLocalCertificate } from "./local-cert.mjs";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
process.chdir(root);
const PORT = Number(process.env.PORT) || 3000;
const wantHttp = process.argv.includes("--http");
const isWin = process.platform === "win32";

const major = Number(process.versions.node.split(".")[0]);
if (major < 20) {
  console.error(`\nNode.js ${process.versions.node} é antigo. Instale o Node.js 22 (LTS) em https://nodejs.org e abra de novo.\n`);
  process.exit(1);
}

function run(cmd, args, label) {
  console.log(`\n→ ${label}…`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: isWin, env: { ...process.env, LOCAL_ONLY: "1", NEXT_TELEMETRY_DISABLED: "1" } });
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
const codeTime = `local-v2:${Math.max(newest(join(root, "src")), statSync(join(root, "package-lock.json")).mtimeMs, statSync(join(root, "next.config.ts")).mtimeMs)}`;
const built = existsSync(join(root, ".next", "BUILD_ID")) && existsSync(stampFile) && readFileSync(stampFile, "utf8") === codeTime;
if (!built) {
  run(process.execPath, [nextBin, "build"], "Preparar o sistema (leva alguns minutos na primeira vez)");
  writeFileSync(stampFile, codeTime);
}

function openBrowser(url) {
  const opener = isWin ? ["cmd", ["/c", "start", "", url]] : process.platform === "darwin" ? ["open", [url]] : ["xdg-open", [url]];
  try {
    const child = spawn(opener[0], opener[1], { stdio: "ignore", detached: true });
    child.on("error", () => console.log(`Abra no navegador: ${url}`));
    child.unref();
  } catch {
    console.log(`Abra no navegador: ${url}`);
  }
}

let tls = null;
if (!wantHttp) {
  try {
    tls = ensureLocalCertificate(join(root, ".local-https"));
  } catch (e) {
    console.log(`\nNão foi possível preparar o HTTPS (${e instanceof Error ? e.message : e}). Abrindo sem HTTPS, ainda só neste computador.`);
  }
}

if (tls) {
  // Servidor HTTPS próprio, usando o Next.js como biblioteca
  process.env.LOCAL_ONLY = "1";
  process.env.NODE_ENV = "production";
  process.env.NEXT_TELEMETRY_DISABLED = "1";
  const require = createRequire(import.meta.url);
  const nextMod = require(join(root, "node_modules", "next"));
  const app = (nextMod.default ?? nextMod)({ dev: false, dir: root, hostname: "localhost", port: PORT });
  await app.prepare();
  const handle = app.getRequestHandler();
  const onRequest = (req, res) => {
    req.headers["x-forwarded-proto"] = "https";
    handle(req, res);
  };
  const url = `https://localhost:${PORT}`;
  const v4 = createServer({ key: tls.key, cert: tls.cert }, onRequest);
  v4.on("error", (e) => {
    console.error(e.code === "EADDRINUSE" ? `\nA porta ${PORT} já está em uso — o NeuroPlanner provavelmente já está aberto: ${url}\n` : e);
    process.exit(1);
  });
  v4.listen(PORT, "127.0.0.1", () => {
    console.log(`\nNeuroPlanner aberto só neste computador: ${url}\nPara fechar, feche esta janela (ou Ctrl+C).\n`);
    openBrowser(url);
  });
  // Alguns navegadores resolvem "localhost" para o endereço IPv6 do próprio computador (::1)
  const v6 = createServer({ key: tls.key, cert: tls.cert }, onRequest);
  v6.on("error", () => {});
  v6.listen(PORT, "::1");
} else {
  const url = `http://localhost:${PORT}`;
  console.log(`\nNeuroPlanner aberto só neste computador: ${url}\nPara fechar, feche esta janela (ou Ctrl+C).\n`);
  const server = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(PORT)], {
    stdio: "inherit",
    env: { ...process.env, LOCAL_ONLY: "1", NEXT_TELEMETRY_DISABLED: "1" },
  });
  setTimeout(() => openBrowser(url), 2500);
  server.on("exit", (code) => process.exit(code ?? 0));
}
