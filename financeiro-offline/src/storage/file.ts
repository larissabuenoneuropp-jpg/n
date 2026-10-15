// Arquivo de dados no computador. No Chrome/Edge, a página grava direto no arquivo que você escolheu
// (API de acesso a arquivos do navegador). Nos demais, trabalha em memória e você baixa o arquivo
// atualizado com "Salvar arquivo".

interface FsHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(o: { mode: "readwrite" }): Promise<PermissionState>;
}
type PickerTypes = Array<{ description: string; accept: Record<string, string[]> }>;
interface FsWindow {
  showOpenFilePicker(o: { types: PickerTypes; multiple: boolean }): Promise<FsHandle[]>;
  showSaveFilePicker(o: { types: PickerTypes; suggestedName: string }): Promise<FsHandle>;
}

export type FileHandle = FsHandle;
export const FILE_EXT = ".mfin";
const TYPES: PickerTypes = [{ description: "Meu Financeiro (criptografado)", accept: { "application/octet-stream": [FILE_EXT] } }];

export const hasDirectWrite = () => typeof window !== "undefined" && "showSaveFilePicker" in window && "showOpenFilePicker" in window;
const fsw = () => window as unknown as FsWindow;

export function isAbort(e: unknown) {
  return e instanceof DOMException && e.name === "AbortError";
}

/** Escolhe um arquivo existente. Devolve o conteúdo e, se possível, o "atalho" para gravar nele. */
export async function pickExisting(): Promise<{ text: string; name: string; handle: FsHandle | null }> {
  if (hasDirectWrite()) {
    const [handle] = await fsw().showOpenFilePicker({ types: TYPES, multiple: false });
    const file = await handle.getFile();
    return { text: await file.text(), name: file.name, handle };
  }
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = `${FILE_EXT},application/json`;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return reject(new DOMException("cancelado", "AbortError"));
      resolve({ text: await file.text(), name: file.name, handle: null });
    };
    input.click();
  });
}

export async function pickNewLocation(suggestedName: string): Promise<FsHandle | null> {
  if (!hasDirectWrite()) return null;
  return fsw().showSaveFilePicker({ types: TYPES, suggestedName });
}

export async function writeToHandle(handle: FsHandle, text: string) {
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

/** O navegador pede confirmação para editar o arquivo a cada vez que a página é aberta. */
export async function ensureWritePermission(handle: FsHandle) {
  if (!handle.queryPermission || !handle.requestPermission) return true;
  if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return (await handle.requestPermission({ mode: "readwrite" })) === "granted";
}

export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/octet-stream" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* Lembrar do último arquivo (só o "atalho" para ele — nenhum dado fica no navegador) */
const DB = "meu-financeiro";
function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore("handles");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kv<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T | undefined> {
  try {
    const d = await db();
    return await new Promise((resolve) => {
      const t = d.transaction("handles", mode);
      const r = fn(t.objectStore("handles"));
      t.oncomplete = () => { d.close(); resolve(r.result as T); };
      t.onerror = () => { d.close(); resolve(undefined); };
    });
  } catch {
    return undefined;
  }
}
export const rememberHandle = (h: FsHandle) => kv("readwrite", (s) => s.put(h, "last"));
export const rememberedHandle = () => kv<FsHandle>("readonly", (s) => s.get("last"));
export const forgetHandle = () => kv("readwrite", (s) => s.delete("last"));
