/**
 * Avaliação da senha do cofre (sem enviar nada para lugar nenhum).
 * Estimativa simples de entropia com penalidades para padrões previsíveis. É uma referência:
 * nenhuma régua garante que uma senha seja impossível de adivinhar.
 */

const COMMON = [
  "123456", "1234567", "12345678", "123456789", "1234567890", "654321", "111111", "000000", "121212", "123123",
  "senha", "password", "passw0rd", "qwerty", "asdfgh", "zxcvbn", "abc123", "iloveyou", "admin", "teste", "mudar",
  "brasil", "flamengo", "corinthians", "palmeiras", "gremio", "santos", "jesus", "deus", "amor", "familia",
  "neuroplanner", "neuro", "larissa", "bueno", "rodrigues", "camboriu", "balneario", "clinica", "paciente", "psico",
  "pedagoga", "neuropsicopedagoga", "cofre", "segura", "seguranca",
];
const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "qwertyuiopasdfghjklzxcvbnm", "01234567890"];

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  bits: number;
  problem: string | null;
}

const MIN_LENGTH = 12;
const MIN_BITS = 60;

function normalize(p: string) {
  return p.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/0/g, "o").replace(/1/g, "i").replace(/3/g, "e").replace(/4/g, "a").replace(/5/g, "s").replace(/@/g, "a").replace(/\$/g, "s");
}

export function passphraseStrength(p: string): Strength {
  let pool = 0;
  if (/[a-z]/.test(p)) pool += 26;
  if (/[A-Z]/.test(p)) pool += 26;
  if (/\d/.test(p)) pool += 10;
  if (/[^\w\s]|_|\s/.test(p)) pool += 33;
  if (/[^\x00-\x7f]/.test(p)) pool += 40;
  let effective = p.length;

  // Palavras comuns (inclusive com 0→o, 1→i, @→a...) quase não somam
  const n = normalize(p);
  for (const w of COMMON) {
    if (n.includes(w)) effective -= w.length - 1;
  }
  // Sequências de teclado/alfabeto/números
  for (const seq of SEQUENCES) {
    for (let len = 4; len <= 8; len++) {
      for (let i = 0; i + len <= seq.length; i++) {
        const chunk = seq.slice(i, i + len);
        if (n.includes(chunk) || n.includes([...chunk].reverse().join(""))) { effective -= len - 2; i = seq.length; }
      }
    }
  }
  // Repetições (aaaa, abab...)
  const unique = new Set(p).size;
  if (unique <= p.length / 3) effective = Math.min(effective, unique * 2);
  if (/(.)\1{2,}/.test(p)) effective -= 2;

  const bits = Math.max(0, Math.round(Math.max(0, effective) * Math.log2(Math.max(pool, 1))));
  const score = (bits < 30 ? 0 : bits < 45 ? 1 : bits < MIN_BITS ? 2 : bits < 80 ? 3 : 4) as Strength["score"];
  const label = ["Muito fraca", "Fraca", "Razoável", "Forte", "Muito forte"][score];

  let problem: string | null = null;
  if (p.length < MIN_LENGTH) problem = `Use pelo menos ${MIN_LENGTH} caracteres. Uma frase curta é ótima: “cafe-azul-2026-lua”.`;
  else if (/^\d+$/.test(p)) problem = "Não use só números.";
  else if (bits < MIN_BITS) problem = "Senha previsível (palavras comuns, nomes, sequências ou repetições). Junte 3 ou 4 palavras sem relação, com números ou símbolos.";
  return { score, label, bits, problem };
}

export const passphraseProblem = (p: string) => passphraseStrength(p).problem;
