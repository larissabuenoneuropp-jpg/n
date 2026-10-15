// Arquivo de dados do Meu Financeiro: JSON criptografado com AES-256-GCM.
// A chave vem da senha pelo Argon2id (64 MiB, 3 passadas — parâmetros recomendados pela RFC 9106),
// o mesmo usado no cofre do NeuroPlanner. A senha nunca é gravada; sem ela o arquivo não abre.

export const FILE_FORMAT = "meu-financeiro";

export interface Kdf {
  name: "Argon2id";
  iterations: number;
  memoryKiB: number;
  parallelism: number;
}

export interface DataFile {
  format: typeof FILE_FORMAT;
  version: 1;
  kdf: Kdf;
  salt: string;
  iv: string;
  data: string;
  saved_at: string;
}

export const DEFAULT_KDF: Kdf = { name: "Argon2id", iterations: 3, memoryKiB: 65536, parallelism: 1 };

const enc = new TextEncoder();
const dec = new TextDecoder();

export const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
export const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

/** Cabeçalho autenticado: trocar formato, versão ou parâmetros invalida o arquivo. */
const aad = (kdf: Kdf, salt: string) => enc.encode(`${FILE_FORMAT}|1|${kdf.name}|${kdf.iterations}|${kdf.memoryKiB}|${kdf.parallelism}|${salt}`);

export async function deriveKey(pass: string, salt: Uint8Array, kdf: Kdf = DEFAULT_KDF): Promise<CryptoKey> {
  const { argon2id } = await import("hash-wasm");
  const bytes = await argon2id({
    password: pass.normalize("NFC"), salt, iterations: kdf.iterations, parallelism: kdf.parallelism,
    memorySize: kdf.memoryKiB, hashLength: 32, outputType: "binary",
  });
  try {
    return await crypto.subtle.importKey("raw", bytes as BufferSource, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  } finally {
    bytes.fill(0);
  }
}

export interface Session {
  key: CryptoKey;
  salt: string;
  kdf: Kdf;
}

export async function newSession(pass: string): Promise<Session> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(pass, salt), salt: toB64(salt), kdf: DEFAULT_KDF };
}

export async function seal(content: unknown, s: Session): Promise<DataFile> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource, additionalData: aad(s.kdf, s.salt) as BufferSource }, s.key, enc.encode(JSON.stringify(content)) as BufferSource);
  return { format: FILE_FORMAT, version: 1, kdf: s.kdf, salt: s.salt, iv: toB64(iv), data: toB64(new Uint8Array(cipher)), saved_at: new Date().toISOString() };
}

export function parseDataFile(text: string): DataFile {
  let d: DataFile;
  try {
    d = JSON.parse(text);
  } catch {
    throw new Error("Este arquivo não é um arquivo do Meu Financeiro.");
  }
  if (!d || d.format !== FILE_FORMAT || d.version !== 1 || !d.salt || !d.iv || !d.data || d.kdf?.name !== "Argon2id") throw new Error("Este arquivo não é um arquivo do Meu Financeiro (ou é de uma versão mais nova).");
  // Limites de segurança para não travar o navegador com parâmetros absurdos
  if (d.kdf.memoryKiB > 1048576 || d.kdf.iterations > 20 || d.kdf.parallelism > 8) throw new Error("Parâmetros de criptografia inválidos.");
  return d;
}

/** Abre o arquivo com a senha. Senha errada ou arquivo alterado → erro. */
export async function unseal<T>(file: DataFile, pass: string): Promise<{ content: T; session: Session }> {
  const key = await deriveKey(pass, fromB64(file.salt), file.kdf);
  const session: Session = { key, salt: file.salt, kdf: file.kdf };
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromB64(file.iv) as BufferSource, additionalData: aad(file.kdf, file.salt) as BufferSource }, key, fromB64(file.data) as BufferSource);
    return { content: JSON.parse(dec.decode(plain)) as T, session };
  } catch {
    throw new Error("Senha incorreta (ou o arquivo foi alterado).");
  }
}
