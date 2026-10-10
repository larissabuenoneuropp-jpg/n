"use client";
// Arquivos do modo pessoal/demonstração guardados no IndexedDB do navegador (muito mais espaço que o localStorage).

const DB = "neuroplanner-files";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const isIdbAvailable = () => typeof indexedDB !== "undefined";
/** Guarda um Blob (modo demonstração) ou um arquivo criptografado (cofre do modo pessoal). */
export const putFile = (key: string, value: Blob | object) => tx("readwrite", (s) => s.put(value, key));
export const getFile = (key: string) => tx<unknown>("readonly", (s) => s.get(key) as IDBRequest<unknown>);
export const deleteFile = (key: string) => tx("readwrite", (s) => s.delete(key));
export const allFileKeys = () => tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys());
export const clearFiles = () => tx("readwrite", (s) => s.clear());

/** Pede ao navegador para não apagar os dados locais automaticamente (quando houver pouco espaço). */
export async function requestPersistence() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) return await navigator.storage.persist();
    return true;
  } catch {
    return false;
  }
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate();
    return e ? { usage: e.usage ?? 0, quota: e.quota ?? 0 } : null;
  } catch {
    return null;
  }
}

export const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(b);
  });

/** Converte data URL em Blob sem fetch (compatível com a Content-Security-Policy do site). */
export async function dataUrlToBlob(url: string) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) throw new Error("Arquivo do backup inválido.");
  const type = m[1] || "application/octet-stream";
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type });
  const bin = atob(m[3]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
