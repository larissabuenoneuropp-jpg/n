"use client";
import { isPersonalMode } from "@/lib/supabase/config";
import { vaultGet, vaultSet } from "@/lib/data/vault";

// Fica dentro do cofre criptografado e não entra nos backups (prefixo _local:)
const KEY = "_local:server_access_key";

export function getAccessKey() {
  if (!isPersonalMode) return "";
  try {
    const v = vaultGet(KEY);
    return v ? (JSON.parse(v) as string) : "";
  } catch {
    return "";
  }
}
export function setAccessKey(k: string) {
  vaultSet(KEY, JSON.stringify(k.trim()));
}

/** fetch para as rotas /api do próprio site, com a chave de acesso do servidor (uso pessoal). */
export function apiFetch(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  const key = getAccessKey();
  if (key) headers.set("x-access-key", key);
  return fetch(url, { ...init, headers, credentials: "same-origin", cache: "no-store" });
}
