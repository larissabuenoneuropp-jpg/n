"use client";
import { vaultGet, vaultSet } from "@/lib/data/vault";

/** Preferências de bloqueio do cofre (guardadas dentro do próprio cofre, fora dos backups). */
export interface LockSettings {
  /** Minutos sem uso até bloquear. */
  idleMin: 5 | 10 | 15 | 30;
  /** Ao minimizar ou trocar de aba: bloquear na hora, após 1 minuto, ou só pela inatividade. */
  onHide: "now" | "1min" | "off";
}
export const DEFAULT_LOCK: LockSettings = { idleMin: 10, onHide: "1min" };
const KEY = "_local:lock_settings";

export function getLockSettings(): LockSettings {
  try {
    const raw = vaultGet(KEY);
    return raw ? { ...DEFAULT_LOCK, ...(JSON.parse(raw) as Partial<LockSettings>) } : DEFAULT_LOCK;
  } catch {
    return DEFAULT_LOCK;
  }
}
export function setLockSettings(s: LockSettings) {
  vaultSet(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event("np:lock-settings"));
}
