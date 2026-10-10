import type { AuditLog, Profile, TableMap, TableName } from "@/lib/types";

export interface ListOptions<T> {
  filter?: Partial<T>;
  orderBy?: keyof T & string;
  ascending?: boolean;
}

/**
 * Contrato único de acesso a dados. Há duas implementações:
 *  - SupabaseStore (produção: Postgres + RLS + Storage)
 *  - DemoStore (modo demonstração: localStorage, sem servidor)
 * Novos módulos (portal da família, app mobile, integrações) dependem só deste contrato.
 */
export interface DataStore {
  readonly mode: "supabase" | "demo";
  list<K extends TableName>(table: K, opts?: ListOptions<TableMap[K]>): Promise<TableMap[K][]>;
  get<K extends TableName>(table: K, id: string): Promise<TableMap[K] | null>;
  insert<K extends TableName>(table: K, values: Partial<TableMap[K]>): Promise<TableMap[K]>;
  insertMany<K extends TableName>(table: K, values: Partial<TableMap[K]>[]): Promise<void>;
  update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>): Promise<TableMap[K]>;
  remove(table: TableName, id: string): Promise<void>;
  getProfile(): Promise<Profile>;
  saveProfile(patch: Partial<Profile>): Promise<Profile>;
  /** Envia arquivo e retorna o caminho no storage. */
  upload(file: File, folder: string): Promise<string>;
  /** URL temporária para visualizar/baixar um arquivo privado. */
  fileUrl(path: string): Promise<string>;
  removeFile(path: string): Promise<void>;
  auditLogs(limit?: number): Promise<AuditLog[]>;
  /** Exporta todos os dados do profissional (portabilidade — LGPD art. 18). */
  exportAll(): Promise<Record<string, unknown>>;
}
