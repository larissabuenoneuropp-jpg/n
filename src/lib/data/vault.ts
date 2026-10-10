"use client";
/**
 * Cofre local do modo pessoal: os dados ficam no navegador, mas criptografados (AES-GCM 256).
 *
 * - Uma chave de dados (DEK) aleatória criptografa os registros e os arquivos.
 * - A DEK é guardada "embrulhada" por uma chave derivada da senha (PBKDF2-SHA256).
 * - Trocar a senha só reembrulha a DEK; os dados não precisam ser recriptografados.
 * - Sem a senha não há como recuperar os dados (não existe servidor nem "esqueci a senha").
 */

import { allFileKeys, getFile, isIdbAvailable, putFile } from "./local-files";

const DB = "neuroplanner-vault";
const STORE = "kv";
const ITERATIONS = 600_000;
const LEGACY_PREFIX = "np:demo:";

interface VaultMeta {
  v: 1;
  salt: Uint8Array;
  iterations: number;
  wrapIv: Uint8Array;
  wrapped: ArrayBuffer;
}
interface Sealed {
  iv: Uint8Array;
  ct: ArrayBuffer;
}
/** Arquivo criptografado guardado no IndexedDB de arquivos. */
export interface SealedFile extends Sealed {
  enc: 1;
  type: string;
}

let dek: CryptoKey | null = null;
let cache: Map<string, string> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saving: Promise<void> = Promise.resolve();
let inflight = 0;
let failures = 0;

// ---------- Várias abas abertas ----------
// Cada aba tem a sua cópia em memória; quando uma grava, as outras recarregam do cofre para não sobrescrever nada.
const TAB = Math.random().toString(36).slice(2);
let channel: BroadcastChannel | null = null;
function bus() {
  if (!channel && typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel("neuroplanner-vault");
    channel.onmessage = async (e: MessageEvent<{ type: string; from: string }>) => {
      if (e.data?.from === TAB) return;
      if (e.data.type === "lock" || e.data.type === "destroyed") {
        window.dispatchEvent(new CustomEvent("np:lock", { detail: { remote: true } }));
      } else if (e.data.type === "saved" && dek && !saveTimer) {
        try {
          const data = await getData();
          if (data && dek) {
            cache = new Map(Object.entries(JSON.parse(dec.decode(await open(dek, data))) as Record<string, string>));
            window.dispatchEvent(new Event("np:vault-changed"));
          }
        } catch { /* mantém a cópia atual */ }
      }
    };
  }
  return channel;
}
const broadcast = (type: string) => bus()?.postMessage({ type, from: TAB });

// ---------- IndexedDB ----------
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kv<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(req.result as T); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error ?? new Error("Gravação cancelada pelo navegador.")); };
  });
}
const getMeta = () => kv<VaultMeta | undefined>("readonly", (s) => s.get("meta"));
const getData = () => kv<Sealed | undefined>("readonly", (s) => s.get("data"));

// ---------- Criptografia ----------
const enc = new TextEncoder();
const dec = new TextDecoder();
const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

async function deriveKek(pass: string, salt: Uint8Array, iterations: number) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pass.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}
async function wrapDek(key: CryptoKey, pass: string) {
  const salt = randomBytes(16);
  const wrapIv = randomBytes(12);
  const kek = await deriveKek(pass, salt, ITERATIONS);
  const wrapped = await crypto.subtle.wrapKey("raw", key, kek, { name: "AES-GCM", iv: wrapIv as BufferSource });
  return { v: 1, salt, iterations: ITERATIONS, wrapIv, wrapped } as VaultMeta;
}
async function unwrapDek(meta: Pick<VaultMeta, "salt" | "iterations" | "wrapIv" | "wrapped">, pass: string) {
  const kek = await deriveKek(pass, meta.salt, meta.iterations);
  try {
    return await crypto.subtle.unwrapKey("raw", meta.wrapped, kek, { name: "AES-GCM", iv: meta.wrapIv as BufferSource }, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  } catch {
    throw new Error("Senha incorreta.");
  }
}
async function seal(key: CryptoKey, bytes: BufferSource): Promise<Sealed> {
  const iv = randomBytes(12);
  return { iv, ct: await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, key, bytes) };
}
async function open(key: CryptoKey, s: Sealed) {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: s.iv as BufferSource }, key, s.ct);
}

// ---------- Estado ----------
export const isVaultSupported = () => typeof indexedDB !== "undefined" && typeof crypto !== "undefined" && !!crypto.subtle;
export const isUnlocked = () => !!dek && !!cache;
export async function vaultExists() {
  return !!(await getMeta());
}

function assertKey() {
  if (!dek) throw new Error("O cofre está bloqueado.");
  return dek;
}

async function persistNow() {
  if (!dek || !cache) return;
  const sealed = await seal(dek, enc.encode(JSON.stringify(Object.fromEntries(cache))));
  await kv("readwrite", (s) => s.put(sealed, "data"));
  broadcast("saved");
}

/** Leitura síncrona do cache em memória (só existe com o cofre aberto). */
export function vaultGet(key: string): string | null {
  return cache?.get(key) ?? null;
}
export function vaultHas(key: string) {
  return !!cache?.has(key);
}
/** Grava no cache e agenda a gravação criptografada (agrupa várias alterações seguidas). */
export function vaultSet(key: string, raw: string) {
  if (!cache) throw new Error("O cofre está bloqueado. Desbloqueie para continuar.");
  cache.set(key, raw);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; void flushVault(); }, 60);
}
export function vaultKeys() {
  return cache ? [...cache.keys()] : [];
}
/** Limpa os dados (ao restaurar backup), preservando configurações locais deste navegador (prefixo _local:). */
export function vaultClearCache() {
  if (!cache) return;
  for (const k of [...cache.keys()]) if (!k.startsWith("_local:")) cache.delete(k);
}

/** Garante que tudo o que está em memória foi gravado (criptografado) no navegador. */
export function flushVault() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  inflight++;
  saving = saving.catch(() => {}).then(persistNow).finally(() => { inflight--; });
  return saving;
}

/** Há alteração ainda não gravada no navegador? (usado para avisar antes de fechar/recarregar a página) */
export const hasPendingWrites = () => !!saveTimer || inflight > 0;

/** Primeiro uso: cria o cofre e migra dados antigos sem criptografia (se houver). */
export async function createVault(pass: string) {
  if (await vaultExists()) throw new Error("Já existe um cofre neste navegador.");
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const meta = await wrapDek(key, pass);
  const legacy = new Map<string, string>();
  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(LEGACY_PREFIX)) legacy.set(k.slice(LEGACY_PREFIX.length), localStorage.getItem(k) ?? "");
  }
  dek = key;
  cache = legacy;
  bus();
  const sealed = await seal(key, enc.encode(JSON.stringify(Object.fromEntries(cache))));
  await kv("readwrite", (s) => { s.put(sealed, "data"); return s.put(meta, "meta"); });
  // Só apaga a cópia aberta depois que a criptografada foi gravada
  for (const k of legacy.keys()) localStorage.removeItem(LEGACY_PREFIX + k);
  // Arquivos anexados antes do cofre: criptografa no lugar
  let files = 0;
  if (isIdbAvailable()) {
    for (const k of await allFileKeys().catch(() => [] as IDBValidKey[])) {
      const v = await getFile(String(k));
      if (v instanceof Blob) { await putFile(String(k), await sealFile(v)); files++; }
    }
  }
  return { migrated: legacy.size > 0 || files > 0 };
}

export async function unlockVault(pass: string) {
  if (failures > 0) await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** (failures - 1))));
  const meta = await getMeta();
  if (!meta) throw new Error("Nenhum cofre encontrado neste navegador.");
  let key: CryptoKey;
  try {
    key = await unwrapDek(meta, pass);
  } catch (e) {
    failures++;
    throw e;
  }
  const data = await getData();
  const obj = data ? (JSON.parse(dec.decode(await open(key, data))) as Record<string, string>) : {};
  failures = 0;
  dek = key;
  cache = new Map(Object.entries(obj));
  bus();
}

/** Grava o que estiver pendente e apaga a chave e os dados da memória. `everywhere` bloqueia também as outras abas. */
export async function lockVault(everywhere = false) {
  await flushVault().catch(() => {});
  dek = null;
  cache = null;
  if (everywhere) broadcast("lock");
}

export async function changePassphrase(current: string, next: string) {
  const meta = await getMeta();
  if (!meta) throw new Error("Nenhum cofre encontrado.");
  const key = await unwrapDek(meta, current);
  const fresh = await wrapDek(key, next);
  await kv("readwrite", (s) => s.put(fresh, "meta"));
}

/** Apaga o cofre inteiro (usado em "esqueci a senha" e em "apagar todos os dados"). */
export async function destroyVault() {
  dek = null;
  cache = null;
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB);
    req.onsuccess = req.onerror = req.onblocked = () => resolve();
  });
  for (const k of Object.keys(localStorage)) if (k.startsWith(LEGACY_PREFIX)) localStorage.removeItem(k);
  broadcast("destroyed");
}

// ---------- Arquivos ----------
export async function sealFile(blob: Blob): Promise<SealedFile> {
  const s = await seal(assertKey(), await blob.arrayBuffer());
  return { enc: 1, type: blob.type || "application/octet-stream", ...s };
}
export async function openFile(f: SealedFile) {
  return new Blob([await open(assertKey(), f)], { type: f.type });
}
export const isSealedFile = (v: unknown): v is SealedFile => !!v && typeof v === "object" && (v as SealedFile).enc === 1;

// ---------- Backup criptografado ----------
export const ENCRYPTED_BACKUP_FORMAT = "neuroplanner-backup-enc";

function toB64(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}
function fromB64(s: string) {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Criptografa o backup com a mesma chave do cofre; abre com a senha usada na data do backup. */
export async function encryptBackup(plain: Record<string, unknown>) {
  const meta = await getMeta();
  if (!meta) throw new Error("Nenhum cofre encontrado.");
  const sealed = await seal(assertKey(), enc.encode(JSON.stringify(plain)));
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: 1,
    exported_at: new Date().toISOString(),
    note: "Backup criptografado do NeuroPlanner. Só abre no NeuroPlanner, com a senha do cofre usada quando ele foi gerado.",
    kdf: { name: "PBKDF2-SHA256", salt: toB64(meta.salt), iterations: meta.iterations },
    key: { iv: toB64(meta.wrapIv), wrapped: toB64(meta.wrapped) },
    iv: toB64(sealed.iv),
    ct: toB64(sealed.ct),
  };
}

export const isEncryptedBackup = (d: unknown) => !!d && typeof d === "object" && (d as { format?: string }).format === ENCRYPTED_BACKUP_FORMAT;

export async function decryptBackup(d: Record<string, unknown>, pass: string) {
  const kdf = d.kdf as { salt: string; iterations: number };
  const k = d.key as { iv: string; wrapped: string };
  const key = await unwrapDek({ salt: fromB64(kdf.salt), iterations: kdf.iterations, wrapIv: fromB64(k.iv), wrapped: fromB64(k.wrapped).buffer as ArrayBuffer }, pass);
  try {
    const bytes = await open(key, { iv: fromB64(d.iv as string), ct: fromB64(d.ct as string).buffer as ArrayBuffer });
    return JSON.parse(dec.decode(bytes)) as Record<string, unknown>;
  } catch {
    throw new Error("O arquivo de backup está corrompido ou foi alterado.");
  }
}
