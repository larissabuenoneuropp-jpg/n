// Substitui o provider do NeuroPlanner no app independente: mesmos hooks (useData/useCollection),
// lendo e gravando no MemoryStore do arquivo aberto.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Profile, TableMap, TableName } from "@/lib/types";
import type { ListOptions } from "@/lib/data/store";
import type { MemoryStore } from "../storage/memory-store";

interface Ctx {
  store: MemoryStore;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  version: Record<string, number>;
  bump: (table: TableName) => void;
}

const DataContext = createContext<Ctx | null>(null);

export function DataProvider({ store, children }: { store: MemoryStore; children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [version, setVersion] = useState<Record<string, number>>({});
  const refreshProfile = useCallback(async () => setProfile({ ...(await store.getProfile()) }), [store]);
  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);
  const bump = useCallback((t: TableName) => setVersion((v) => ({ ...v, [t]: (v[t] ?? 0) + 1 })), []);
  return <DataContext.Provider value={{ store, profile, refreshProfile, version, bump }}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData fora do DataProvider");
  return ctx;
}

export function useCollection<K extends TableName>(table: K, opts: ListOptions<TableMap[K]> = {}, enabled = true) {
  const { store, version, bump } = useData();
  const [data, setData] = useState<TableMap[K][]>([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(opts);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    store.list(table, JSON.parse(key)).then((rows) => {
      if (alive) {
        setData(rows);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [store, table, key, version[table], enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  const insert = useCallback(async (v: Partial<TableMap[K]>) => { const r = await store.insert(table, v); bump(table); return r; }, [store, table, bump]);
  const update = useCallback(async (id: string, patch: Partial<TableMap[K]>) => { const r = await store.update(table, id, patch); bump(table); return r; }, [store, table, bump]);
  const remove = useCallback(async (id: string) => { await store.remove(table, id); bump(table); }, [store, table, bump]);
  return { data, loading, error: null as string | null, insert, update, remove };
}
