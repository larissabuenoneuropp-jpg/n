"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Profile, TableMap, TableName } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { DataStore, ListOptions } from "./store";
import { SupabaseStore } from "./supabase-store";
import { DemoStore } from "./demo-store";
import { ALL_TABLES } from "./tables";
import { ACTIVITY_LIBRARY } from "./activities-library";
import { INSTRUMENT_LIBRARY } from "./instruments-library";
import { ensureReceipt } from "@/lib/documents";
import { generateChargeQueue } from "@/lib/billing";

interface Ctx {
  store: DataStore;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  /** Incrementa quando qualquer tabela muda, para recarregar listas dependentes. */
  version: Record<string, number>;
  bump: (table: TableName) => void;
}


const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const store = useMemo<DataStore>(
    () => (isSupabaseConfigured ? new SupabaseStore(getSupabaseBrowser()) : new DemoStore()),
    [],
  );
  const [profile, setProfile] = useState<Profile | null>(null);
  const [version, setVersion] = useState<Record<string, number>>({});

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await store.getProfile());
    } catch {
      setProfile(null);
    }
  }, [store]);

  useEffect(() => {
    refreshProfile();
    // Primeiro acesso no Supabase: copia a biblioteca de atividades para a conta.
    if (store.mode === "supabase") {
      store.list("activities").then((rows) => {
        if (rows.length === 0) store.insertMany("activities", ACTIVITY_LIBRARY.map((a) => ({ ...a, favorite: false })));
      }).catch(() => {});
      store.list("instruments").then(async (rows) => {
        if (rows.length === 0) return store.insertMany("instruments", INSTRUMENT_LIBRARY.map((i) => ({ ...i, favorite: false })));
        // Atualização da biblioteca: inclui instrumentos novos e completa referência/seção do RAN
        const byName = new Map(rows.map((r) => [r.name.toLowerCase(), r]));
        const missing = INSTRUMENT_LIBRARY.filter((i) => !byName.has(i.name.toLowerCase()));
        if (missing.length) await store.insertMany("instruments", missing.map((i) => ({ ...i, favorite: false })));
        for (const lib of INSTRUMENT_LIBRARY) {
          const row = byName.get(lib.name.toLowerCase());
          if (row && ((!row.reference && lib.reference) || (!row.ran_domain && lib.ran_domain))) {
            await store.update("instruments", row.id, { reference: row.reference || lib.reference, ran_domain: row.ran_domain || lib.ran_domain });
          }
        }
      }).catch(() => {});
    }
  }, [store, refreshProfile]);

  const bump = useCallback((t: TableName) => setVersion((v) => ({ ...v, [t]: (v[t] ?? 0) + 1 })), []);

  // Modo pessoal com mais de uma aba: outra aba gravou no cofre → recarrega tudo nesta
  useEffect(() => {
    const onChange = () => {
      setVersion((v) => Object.fromEntries([...ALL_TABLES, ...Object.keys(v)].map((t) => [t, (v[t] ?? 0) + 1])));
      refreshProfile();
    };
    window.addEventListener("np:vault-changed", onChange);
    return () => window.removeEventListener("np:vault-changed", onChange);
  }, [refreshProfile]);

  // Cobranças: prepara as mensagens do dia (ficam aguardando aprovação; nada é enviado aqui)
  const [billingChecked, setBillingChecked] = useState(false);
  useEffect(() => {
    if (!profile || billingChecked) return;
    setBillingChecked(true);
    generateChargeQueue(store, profile).then((r) => { if (r.created || r.cancelled) bump("charge_messages"); }).catch(() => {});
  }, [profile, billingChecked, store, bump]);

  return (
    <DataContext.Provider value={{ store, profile, refreshProfile, version, bump }}>{children}</DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData deve ser usado dentro de <DataProvider>");
  return ctx;
}

/** Lista reativa de uma tabela, com operações de escrita que atualizam todas as telas. */
export function useCollection<K extends TableName>(table: K, opts: ListOptions<TableMap[K]> = {}, enabled = true) {
  const { store, version, bump, profile } = useData();

  /** Efeitos automáticos após gravar: recibo gerado quando uma entrada é marcada como paga. */
  const afterWrite = useCallback(
    async (row: TableMap[K]) => {
      if (table !== "transactions") return;
      try {
        const r = await ensureReceipt(store, row as TableMap["transactions"], profile);
        if (r) bump("receipts");
      } catch (e) {
        console.error("Falha ao gerar recibo", e);
      }
    },
    [table, store, profile, bump],
  );
  const [data, setData] = useState<TableMap[K][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const key = JSON.stringify(opts);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setLoading(true);
    store
      .list(table, JSON.parse(key))
      .then((rows) => alive && (setData(rows), setError(null)))
      .catch((e) => alive && setError(e.message ?? String(e)))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [store, table, key, version[table], enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const insert = useCallback(
    async (v: Partial<TableMap[K]>) => {
      const r = await store.insert(table, v);
      await afterWrite(r);
      bump(table);
      return r;
    },
    [store, table, bump, afterWrite],
  );
  const update = useCallback(
    async (id: string, patch: Partial<TableMap[K]>) => {
      const r = await store.update(table, id, patch);
      await afterWrite(r);
      bump(table);
      return r;
    },
    [store, table, bump, afterWrite],
  );
  const remove = useCallback(
    async (id: string) => {
      await store.remove(table, id);
      bump(table);
    },
    [store, table, bump],
  );

  return { data, loading, error, insert, update, remove };
}

export function useRecord<K extends TableName>(table: K, id: string | undefined) {
  const { store, version, bump } = useData();
  const [data, setData] = useState<TableMap[K] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    store.get(table, id).then((r) => alive && setData(r)).finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [store, table, id, version[table]]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(
    async (patch: Partial<TableMap[K]>) => {
      if (!id) return;
      const r = await store.update(table, id, patch);
      setData(r);
      bump(table);
      return r;
    },
    [store, table, id, bump],
  );

  return { data, loading, update };
}
