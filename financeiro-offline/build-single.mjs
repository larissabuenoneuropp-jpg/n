// Junta o resultado da compilação num ÚNICO arquivo HTML (código e estilos embutidos), para abrir
// com dois cliques, sem servidor e sem internet.
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, "dist");
let html = readFileSync(join(dist, "index.html"), "utf8");

const assets = readdirSync(join(dist, "assets"));
const js = assets.filter((f) => f.endsWith(".js"));
const css = assets.filter((f) => f.endsWith(".css"));
if (js.length !== 1) throw new Error(`Esperado 1 arquivo JS, encontrados ${js.length}: ${js.join(", ")}`);

html = html.replace(/<script type="module" crossorigin src="\.\/assets\/[^"]+\.js"><\/script>/, () => {
  const code = readFileSync(join(dist, "assets", js[0]), "utf8").replace(/<\/script/gi, "<\\/script");
  return `<script type="module">${code}</script>`;
});
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/assets\/[^"]+\.css">/, () => `<style>${css.map((f) => readFileSync(join(dist, "assets", f), "utf8")).join("\n")}</style>`);
if (/src="\.\/assets|href="\.\/assets/.test(html)) throw new Error("Ainda há referências a arquivos externos no HTML.");

const out = join(here, "release");
mkdirSync(out, { recursive: true });
writeFileSync(join(out, "MeuFinanceiro.html"), html);
const sha = createHash("sha256").update(html).digest("hex");
writeFileSync(join(out, "MeuFinanceiro.html.sha256"), `${sha}  MeuFinanceiro.html\n`);
console.log(`release/MeuFinanceiro.html (${(html.length / 1024 / 1024).toFixed(2)} MB) · SHA-256 ${sha}`);
