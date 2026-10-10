"use client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuditLog, Profile, TableMap, TableName } from "@/lib/types";
import type { DataStore, ListOptions } from "./store";
import { safeFileName, validateUpload } from "@/lib/uploads";

/** Campos controlados pelo banco: nunca aceitos do navegador (proteção contra mass assignment). */
function clean(values: Record<string, unknown>) {
  const { id: _i, owner_id: _o, created_at: _c, updated_at: _u, ...rest } = values;
  return rest;
}

const TABLES: TableName[] = [
  "patients", "assessments", "intervention_plans", "appointments", "session_records",
  "activities", "documents", "transactions", "reports", "instruments", "assessment_records", "receipts", "tasks", "social_posts", "charge_messages",
];
const BUCKET = "documents";

export class SupabaseStore implements DataStore {
  readonly mode = "supabase" as const;
  constructor(private sb: SupabaseClient) {}

  private async uid() {
    const { data } = await this.sb.auth.getUser();
    if (!data.user) throw new Error("Sessão expirada. Faça login novamente.");
    return data.user.id;
  }

  async list<K extends TableName>(table: K, opts: ListOptions<TableMap[K]> = {}) {
    let q = this.sb.from(table).select("*");
    for (const [k, v] of Object.entries(opts.filter ?? {})) q = q.eq(k, v as string);
    q = q.order(opts.orderBy ?? "created_at", { ascending: opts.ascending ?? false });
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as TableMap[K][];
  }

  async get<K extends TableName>(table: K, id: string) {
    const { data, error } = await this.sb.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as TableMap[K] | null;
  }

  async insert<K extends TableName>(table: K, values: Partial<TableMap[K]>) {
    const { data, error } = await this.sb.from(table).insert(clean(values as Record<string, unknown>)).select().single();
    if (error) throw error;
    return data as TableMap[K];
  }

  async insertMany<K extends TableName>(table: K, values: Partial<TableMap[K]>[]) {
    if (!values.length) return;
    const { error } = await this.sb.from(table).insert((values as Record<string, unknown>[]).map(clean));
    if (error) throw error;
  }

  async update<K extends TableName>(table: K, id: string, patch: Partial<TableMap[K]>) {
    const { data, error } = await this.sb.from(table).update(clean(patch as Record<string, unknown>)).eq("id", id).select().single();
    if (error) throw error;
    return data as TableMap[K];
  }

  async remove(table: TableName, id: string) {
    const { error } = await this.sb.from(table).delete().eq("id", id);
    if (error) throw error;
  }

  async getProfile() {
    const id = await this.uid();
    const { data, error } = await this.sb.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return (data ?? { id }) as Profile;
  }

  async saveProfile(patch: Partial<Profile>) {
    const id = await this.uid();
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = patch as Record<string, unknown>;
    const { data, error } = await this.sb.from("profiles").update(rest).eq("id", id).select().single();
    if (error) throw error;
    return data as Profile;
  }

  async upload(file: File, folder: string) {
    const { type } = validateUpload(file);
    const id = await this.uid();
    const path = `${id}/${folder.split("/").filter(Boolean).map(safeFileName).join("/")}/${Date.now()}_${safeFileName(file.name)}`;
    const { error } = await this.sb.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: type });
    if (error) throw error;
    return path;
  }

  async fileUrl(path: string) {
    const { data, error } = await this.sb.storage.from(BUCKET).createSignedUrl(path, 60 * 10);
    if (error) throw error;
    return data.signedUrl;
  }

  async removeFile(path: string) {
    const { error } = await this.sb.storage.from(BUCKET).remove([path]);
    if (error) throw error;
  }

  async auditLogs(limit = 100) {
    const { data, error } = await this.sb
      .from("audit_logs")
      .select("id, action, table_name, record_id, at")
      .order("at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as AuditLog[];
  }

  async exportAll() {
    const out: Record<string, unknown> = { exported_at: new Date().toISOString(), profile: await this.getProfile() };
    for (const t of TABLES) out[t] = await this.list(t);
    return out;
  }
}
