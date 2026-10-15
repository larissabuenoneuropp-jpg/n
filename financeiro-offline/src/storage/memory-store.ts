// Dados do Meu Financeiro em memória enquanto o arquivo está aberto. Cada alteração avisa o
// "persistidor", que grava o arquivo criptografado. Implementa o mesmo contrato DataStore do
// NeuroPlanner, para que as telas financeiras funcionem sem mudanças.
import type { AuditLog, Profile, TableMap, TableName } from "@/lib/types";
import type { DataStore, ListOptions } from "@/lib/data/store";

export interface Snapshot {
  app: "meu-financeiro";
  schema: 1;
  profile: Profile;
  tables: Partial<Record<TableName, unknown[]>>;
  files: Record<string, string>;
}

export const emptySnapshot = (): Snapshot => ({ app: "meu-financeiro", schema: 1, profile: { id: "local" }, tables: {}, files: {} });

const MAX_FILE_MB = 3;

function uuid() {
  return crypto.randomUUID();
}

export class MemoryStore implements DataStore {
  readonly mode = "demo" as const;
  private snap: Snapshot;
  private onChange: () => void;

  constructor(snap: Snapshot, onChange: () => void) {
    this.snap = { ...emptySnapshot(), ...snap, tables: { ...(snap.tables ?? {}) }, files: { ...(snap.files ?? {}) } };
    this.onChange = onChange;
  }

  snapshot(): Snapshot {
    return this.snap;
  }

  private rows<K extends TableName>(t: K): TableMap[K][] {
    return (this.snap.tables[t] as TableMap[K][] | undefined) ?? [];
  }
  private setRows<K extends TableName>(t: K, rows: TableMap[K][]) {
    this.snap.tables[t] = rows;
    this.onChange();
  }

  async list<K extends TableName>(table: K, opts: ListOptions<TableMap[K]> = {}) {
    const f = opts.filter ?? {};
    const key = (opts.orderBy ?? "created_at") as string;
    const asc = opts.ascending ?? false;
    return this.rows(table)
      .filter((r) => Object.entries(f).every(([k, v]) => (r as unknown as Record<string, unknown>)[k] === v))
      .sort((a, b) => {
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
    const row = { ...values, id: uuid(), created_at: now, updated_at: now } as TableMap[K];
    this.setRows(table, [row, ...this.rows(table)]);
    return row;
  }

  async insertMany<K extends TableName>(table: K, values: Partial<TableMap[K]>[]) {
    const now = new Date().toISOString();
    this.setRows(table, [...values.map((v) => ({ ...v, id: uuid(), created_at: now, updated_at: now }) as TableMap[K]), ...this.rows(table)]);
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>) {
    let updated: TableMap[K] | undefined;
    const rows = this.rows(table).map((r) => {
      if (r.id !== id) return r;
      updated = { ...r, ...patch, id, created_at: r.created_at, updated_at: new Date().toISOString() };
      return updated;
    });
    if (!updated) throw new Error("Registro não encontrado");
    this.setRows(table, rows);
    return updated;
  }

  async remove(table: TableName, id: string) {
    this.setRows(table, this.rows(table).filter((r) => r.id !== id));
  }

  async getProfile() {
    return this.snap.profile;
  }

  async saveProfile(patch: Partial<Profile>) {
    this.snap.profile = { ...this.snap.profile, ...patch, id: "local" };
    this.onChange();
    return this.snap.profile;
  }

  /** Comprovantes ficam dentro do próprio arquivo criptografado. */
  async upload(file: File) {
    if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`Comprovante maior que ${MAX_FILE_MB} MB. Use uma foto ou PDF menor.`);
    const ok = /^(application\/pdf|image\/(png|jpeg|webp|gif|heic|heif))$/.test(file.type);
    if (!ok) throw new Error("Envie PDF ou imagem (PNG, JPG, WEBP).");
    const buf = new Uint8Array(await file.arrayBuffer());
    let s = "";
    for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const key = `file:${uuid()}`;
    this.snap.files[key] = `data:${file.type};base64,${btoa(s)}`;
    this.onChange();
    return key;
  }

  async fileUrl(path: string) {
    const dataUrl = this.snap.files[path];
    if (!dataUrl) throw new Error("Comprovante não encontrado neste arquivo.");
    const [head, b64] = dataUrl.split(",");
    const mime = head.slice(5, head.indexOf(";"));
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: mime }));
  }

  async removeFile(path: string) {
    delete this.snap.files[path];
    this.onChange();
  }

  async auditLogs(): Promise<AuditLog[]> {
    return [];
  }

  async exportAll() {
    return { ...this.snap, exported_at: new Date().toISOString() } as unknown as Record<string, unknown>;
  }
}
