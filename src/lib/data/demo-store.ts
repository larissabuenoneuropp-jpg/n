"use client";
import type { AuditLog, Profile, TableMap, TableName } from "@/lib/types";
import { uid } from "@/lib/utils";
import type { DataStore, ListOptions } from "./store";
import { buildSeed } from "./seed";

const PREFIX = "np:demo:";
const TABLES: TableName[] = [
  "patients", "assessments", "intervention_plans", "appointments", "session_records",
  "activities", "documents", "transactions", "reports", "instruments", "assessment_records",
];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
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
    if (typeof window !== "undefined" && !read("seeded", false)) {
      const seed = buildSeed();
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
    if (file.size > 1.5 * 1024 * 1024) {
      throw new Error("No modo demonstração o limite é 1,5 MB por arquivo. Configure o Supabase para arquivos maiores.");
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async fileUrl(path: string) {
    return path; // no modo demo o "caminho" já é um data URL
  }

  async removeFile() {}

  async auditLogs(limit = 100) {
    return read<AuditLog[]>("audit", []).slice(0, limit);
  }

  async exportAll() {
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), profile: await this.getProfile() };
    for (const t of TABLES) out[t] = this.rows(t);
    return out;
  }

  static reset() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }
}
