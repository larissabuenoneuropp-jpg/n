"use client";
import type { AuditLog, Instrument, Profile, TableMap, TableName } from "@/lib/types";
import { uid } from "@/lib/utils";
import type { DataStore, ListOptions } from "./store";
import { buildSeed } from "./seed";
import { isPersonalMode } from "@/lib/supabase/config";
import { validateUpload } from "@/lib/uploads";
import { allFileKeys, blobToDataUrl, clearFiles, dataUrlToBlob, deleteFile, getFile, isIdbAvailable, putFile, requestPersistence } from "./local-files";
import { destroyVault, flushVault, isSealedFile, openFile, sealFile, vaultClearCache, vaultGet, vaultSet } from "./vault";

/** Modo pessoal guarda tudo criptografado no cofre; o modo demonstração (dados fictícios) usa o localStorage. */
const VAULT = isPersonalMode;

/** Modo pessoal: começa vazio (sem pacientes fictícios), mantendo bibliotecas, modelos e rotina. */
function initialData() {
  const seed = buildSeed();
  if (!isPersonalMode) return seed;
  return {
    ...seed,
    patients: [], assessments: [], intervention_plans: [], appointments: [], session_records: [], documents: [],
    transactions: [], reports: [], assessment_records: [], receipts: [], social_posts: [], charge_messages: [],
  };
}

const PREFIX = "np:demo:";
const TABLES: TableName[] = [
  "patients", "assessments", "intervention_plans", "appointments", "session_records",
  "activities", "documents", "transactions", "reports", "instruments", "assessment_records", "receipts", "tasks", "social_posts", "charge_messages",
];

function getRaw(key: string) {
  return VAULT ? vaultGet(key) : localStorage.getItem(PREFIX + key);
}
function read<T>(key: string, fallback: T): T {
  try {
    const raw = getRaw(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  if (VAULT) return vaultSet(key, JSON.stringify(value));
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    throw new Error("Armazenamento local cheio. No modo demonstração, prefira arquivos pequenos.");
  }
}

/** Armazenamento no navegador para experimentar o app sem configurar o Supabase. */
export class DemoStore implements DataStore {
  readonly mode = "demo" as const;

  constructor() {
    if (typeof window !== "undefined") requestPersistence();
    if (typeof window !== "undefined" && !read("seeded", false)) {
      const seed = initialData();
      if (isPersonalMode) ["seeded_v2", "seeded_v3", "seeded_v4", "seeded_v5", "seeded_v6", "seeded_v7"].forEach((k) => write(k, true));
      for (const t of TABLES) write(t, seed[t] ?? []);
      write("profile", seed.profile);
      write("audit", []);
      write("seeded", true);
    }
    // Migração do modo demo: tabelas adicionadas depois da primeira versão
    if (typeof window !== "undefined" && !read("seeded_v2", false)) {
      const seed = buildSeed();
      if (read<unknown[]>("instruments", []).length === 0) write("instruments", seed.instruments);
      if (read<unknown[]>("assessment_records", []).length === 0) write("assessment_records", seed.assessment_records);
      write("seeded_v2", true);
    }
    // v3: recibos, dados de contrato e perfil da identidade visual
    if (typeof window !== "undefined" && !read("seeded_v3", false)) {
      const seed = buildSeed();
      if (read<unknown[]>("receipts", []).length === 0) write("receipts", []);
      const profile = read<Profile>("profile", { id: "demo" });
      if (!profile.signature_title) write("profile", { ...seed.profile, templates: { ...seed.profile.templates, ...(profile.templates ?? {}) } });
      write("seeded_v3", true);
    }
    // v4: tarefas da clínica
    if (typeof window !== "undefined" && !read("seeded_v4", false)) {
      if (read<unknown[]>("tasks", []).length === 0) write("tasks", buildSeed().tasks);
      write("seeded_v4", true);
    }
    // v5: conteúdos de Instagram de exemplo
    if (typeof window !== "undefined" && !read("seeded_v5", false)) {
      if (read<unknown[]>("social_posts", []).length === 0) write("social_posts", buildSeed().social_posts);
      write("seeded_v5", true);
    }
    // v6: instrumentos do modelo RAN e campos de referência/seção
    if (typeof window !== "undefined" && !read("seeded_v6", false)) {
      const rows = read<Instrument[]>("instruments", []);
      const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));
      const fresh = buildSeed().instruments;
      const merged = rows.map((r) => {
        const lib = fresh.find((f) => f.name.toLowerCase() === r.name.toLowerCase());
        return lib ? { ...r, reference: r.reference || lib.reference, ran_domain: r.ran_domain || lib.ran_domain, record_fields: r.name === "TAC" || r.name === "Trilhas" ? lib.record_fields : r.record_fields } : r;
      });
      write("instruments", [...merged, ...fresh.filter((f) => !byName.has(f.name.toLowerCase()))]);
      write("seeded_v6", true);
    }
    // v7: fila de cobranças
    if (typeof window !== "undefined" && !read("seeded_v7", false)) {
      if (!getRaw("charge_messages")) write("charge_messages", []);
      write("seeded_v7", true);
    }
  }

  private rows<K extends TableName>(table: K) {
    return read<TableMap[K][]>(table, []);
  }

  private log(action: string, table: string, id?: string) {
    const logs = read<AuditLog[]>("audit", []);
    logs.unshift({ id: Date.now(), action, table_name: table, record_id: id, at: new Date().toISOString() });
    write("audit", logs.slice(0, 300));
  }

  async list<K extends TableName>(table: K, opts: ListOptions<TableMap[K]> = {}) {
    let rows = this.rows(table);
    const f = opts.filter ?? {};
    rows = rows.filter((r) => Object.entries(f).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v));
    const key = (opts.orderBy ?? "created_at") as string;
    const asc = opts.ascending ?? false;
    return [...rows].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[key] ?? "");
      const bv = String((b as unknown as Record<string, unknown>)[key] ?? "");
      return asc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  async get<K extends TableName>(table: K, id: string) {
    return this.rows(table).find((r) => r.id === id) ?? null;
  }

  async insert<K extends TableName>(table: K, values: Partial<TableMap[K]>) {
    const now = new Date().toISOString();
    const row = { id: uid(), created_at: now, updated_at: now, ...values } as TableMap[K];
    write(table, [row, ...this.rows(table)]);
    this.log("insert", table, row.id);
    return row;
  }

  async insertMany<K extends TableName>(table: K, values: Partial<TableMap[K]>[]) {
    const now = new Date().toISOString();
    const rows = values.map((v) => ({ id: uid(), created_at: now, updated_at: now, ...v }) as TableMap[K]);
    write(table, [...rows, ...this.rows(table)]);
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>) {
    let updated: TableMap[K] | undefined;
    const rows = this.rows(table).map((r) => {
      if (r.id !== id) return r;
      updated = { ...r, ...patch, id, updated_at: new Date().toISOString() };
      return updated;
    });
    if (!updated) throw new Error("Registro não encontrado");
    write(table, rows);
    this.log("update", table, id);
    return updated;
  }

  async remove(table: TableName, id: string) {
    write(table, this.rows(table).filter((r) => r.id !== id));
    this.log("delete", table, id);
  }

  async getProfile() {
    return read<Profile>("profile", { id: "demo" });
  }

  async saveProfile(patch: Partial<Profile>) {
    const p = { ...(await this.getProfile()), ...patch };
    write("profile", p);
    this.log("update", "profiles", p.id);
    return p;
  }

  async upload(file: File) {
    // Arquivos vão para o IndexedDB (bem mais espaço); sem IndexedDB, data URL no localStorage (limite pequeno)
    validateUpload(file, isIdbAvailable() ? 25 : 1.5);
    if (isIdbAvailable()) {
      const key = `idb:${uid()}`;
      await putFile(key, VAULT ? await sealFile(file) : file);
      return key;
    }
    if (file.size > 1.5 * 1024 * 1024) throw new Error("Limite de 1,5 MB por arquivo neste navegador.");
    return await blobToDataUrl(file);
  }

  async fileUrl(path: string) {
    if (path.startsWith("idb:")) {
      const blob = await this.fileBlob(path);
      if (!blob) throw new Error("Arquivo não encontrado neste navegador.");
      return URL.createObjectURL(blob);
    }
    return path; // data URL
  }

  /** Lê o arquivo do IndexedDB, descriptografando quando vier do cofre. */
  private async fileBlob(key: string): Promise<Blob | null> {
    const v = await getFile(key);
    if (isSealedFile(v)) return openFile(v);
    return v instanceof Blob ? v : null;
  }

  async removeFile(path: string) {
    if (path.startsWith("idb:")) await deleteFile(path).catch(() => {});
  }

  async auditLogs(limit = 100) {
    return read<AuditLog[]>("audit", []).slice(0, limit);
  }

  /** Backup completo: dados + arquivos (em base64) — use para guardar ou levar para outro computador. */
  async exportAll() {
    const out: Record<string, unknown> = { format: "neuroplanner-backup", version: 1, exported_at: new Date().toISOString(), profile: await this.getProfile() };
    for (const t of TABLES) out[t] = this.rows(t);
    if (isIdbAvailable()) {
      const files: Record<string, string> = {};
      for (const key of await allFileKeys()) {
        const blob = await this.fileBlob(String(key));
        if (blob) files[String(key)] = await blobToDataUrl(blob);
      }
      out._files = files;
    }
    return out;
  }

  /** Restaura um backup gerado por exportAll (substitui os dados deste navegador). */
  static async importAll(data: Record<string, unknown>) {
    if (!data || typeof data !== "object" || !("profile" in data)) throw new Error("Arquivo de backup inválido.");
    if (VAULT) vaultClearCache();
    for (const t of TABLES) write(t, Array.isArray(data[t]) ? data[t] : []);
    write("profile", data.profile);
    ["seeded", "seeded_v2", "seeded_v3", "seeded_v4", "seeded_v5", "seeded_v6", "seeded_v7"].forEach((k) => write(k, true));
    const files = (data._files ?? {}) as Record<string, string>;
    if (isIdbAvailable()) {
      await clearFiles();
      for (const [key, url] of Object.entries(files)) {
        const blob = await dataUrlToBlob(url);
        await putFile(key, VAULT ? await sealFile(blob) : blob);
      }
    }
    if (VAULT) await flushVault();
  }

  static async reset() {
    if (VAULT) {
      await destroyVault();
      if (isIdbAvailable()) await clearFiles().catch(() => {});
      return;
    }
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
    if (isIdbAvailable()) await clearFiles().catch(() => {});
  }
}
