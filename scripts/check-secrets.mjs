// Procura chaves e dados sensíveis nos arquivos versionados. Uso: node scripts/check-secrets.mjs
// (Complementa — não substitui — o "Secret scanning" do GitHub, que pode ser ativado nas configurações do repositório.)
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const PATTERNS = [
  ["Chave OpenAI", /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/],
  ["JWT (ex.: service_role do Supabase)", /eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ["Chave AWS", /AKIA[0-9A-Z]{16}/],
  ["Token GitHub", /gh[pousr]_[A-Za-z0-9]{30,}/],
  ["Token Meta/Instagram/WhatsApp", /EAA[A-Za-z0-9]{40,}/],
  ["Chave Resend", /\bre_[A-Za-z0-9]{20,}/],
  ["Chave privada", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["Variável secreta preenchida", /^(?:OPENAI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|WHATSAPP_TOKEN|INSTAGRAM_ACCESS_TOKEN|APP_ACCESS_KEY)=\S+/m],
];
const BLOCKED_FILES = [/(^|\/)\.env(\.|$)(?!example)/, /\.(pem|key|p12|pfx)$/i];

const files = execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
let problems = 0;
for (const f of files) {
  if (BLOCKED_FILES.some((r) => r.test(f))) { console.error(`✗ Arquivo que não deveria estar no Git: ${f}`); problems++; continue; }
  if (/\.(png|jpe?g|gif|webp|ico|woff2?|ttf|otf|pdf|zip)$/i.test(f) || f === "package-lock.json") continue;
  let text;
  try { text = readFileSync(f, "utf8"); } catch { continue; }
  for (const [label, re] of PATTERNS) {
    if (re.test(text)) { console.error(`✗ ${label} em ${f}`); problems++; }
  }
}
if (problems) { console.error(`\n${problems} problema(s). Remova os segredos e troque (revogue) as chaves expostas.`); process.exit(1); }
console.log(`✓ Nenhum segredo encontrado em ${files.length} arquivos.`);
