"use client";
// Liga os dados guardados (cofre local ou Supabase) ao núcleo de cálculo. Toda tela financeira usa
// este hook: qualquer gravação atualiza a versão da tabela e todos os indicadores são recalculados.
import { useCallback, useMemo } from "react";
import { useCollection, useData } from "@/lib/data/provider";
import type { FinHistory, TableMap, TableName } from "@/lib/types";
import { analyzeFinance, type FinanceAnalysis } from "./analyze";
import { todayISO } from "./calendar";
import type { FinanceData } from "./projection";
import { resolveSettings, type FinanceSettings } from "./settings";

type FinTable = "transactions" | "fin_contracts" | "fin_recurring" | "fin_reserves" | "fin_balances" | "fin_plans";

const TABLE_LABEL: Record<FinTable, string> = {
  transactions: "lançamento",
  fin_contracts: "contrato",
  fin_recurring: "despesa recorrente",
  fin_reserves: "reserva",
  fin_balances: "saldo bancário",
  fin_plans: "compra planejada",
};

/** Resumo legível de um registro para o histórico (sem dados clínicos). */
function describe(table: FinTable, row: Record<string, unknown> | null | undefined) {
  if (!row) return "";
  const v = (k: string) => row[k];
  const money = (x: unknown) => (typeof x === "number" ? x.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "");
  if (table === "transactions") return `${v("type")} · ${v("category")} · ${money(v("amount"))}${v("competence") ? ` · ${v("competence")}` : ""}`;
  if (table === "fin_balances") return `${v("account")} · ${money(v("amount"))} em ${v("date")}`;
  return String(v("description") ?? v("label") ?? v("name") ?? "");
}

/** Apenas os campos financeiros vão para o histórico (nada de nome de paciente). */
function snapshot(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;
  const keep = ["type", "category", "amount", "due_date", "paid_at", "status", "competence", "sessions", "unit_amount", "discount", "nature", "tax_class",
    "payer_kind", "description", "label", "name", "date", "account", "month", "installments", "basis", "start_date", "end_date", "active", "sessions_per_week",
    "target_value", "monthly_contribution", "monthly_amount"];
  return Object.fromEntries(Object.entries(row).filter(([k]) => keep.includes(k)));
}

export function useFinance(enabled = true) {
  const { store, profile, refreshProfile, bump } = useData();
  const transactions = useCollection("transactions", { orderBy: "due_date" }, enabled);
  const contracts = useCollection("fin_contracts", { orderBy: "label", ascending: true }, enabled);
  const recurring = useCollection("fin_recurring", { orderBy: "description", ascending: true }, enabled);
  const reserves = useCollection("fin_reserves", { orderBy: "priority", ascending: true }, enabled);
  const balances = useCollection("fin_balances", { orderBy: "date" }, enabled);
  const plans = useCollection("fin_plans", { orderBy: "month", ascending: true }, enabled);
  const patients = useCollection("patients", { orderBy: "name", ascending: true }, enabled);

  const settings = useMemo(() => resolveSettings(profile?.finance_settings), [profile?.finance_settings]);
  const loading = [transactions, contracts, recurring, reserves, balances, plans].some((c) => c.loading) || !profile;

  const data: FinanceData = useMemo(
    () => ({ settings, transactions: transactions.data, contracts: contracts.data, recurring: recurring.data, plans: plans.data, reserves: reserves.data, balances: balances.data }),
    [settings, transactions.data, contracts.data, recurring.data, plans.data, reserves.data, balances.data],
  );
  const today = todayISO();
  const analysis: FinanceAnalysis | null = useMemo(() => (loading ? null : analyzeFinance(data, today)), [data, loading, today]);

  const log = useCallback(
    async (entry: Partial<FinHistory>) => {
      try {
        await store.insert("fin_history", entry);
        bump("fin_history");
      } catch (e) {
        console.error("Histórico financeiro não gravado", e);
      }
    },
    [store, bump],
  );

  const cols = { transactions, fin_contracts: contracts, fin_recurring: recurring, fin_reserves: reserves, fin_balances: balances, fin_plans: plans };

  /** Grava com histórico de alterações (antes/depois). */
  const save = useCallback(
    async <K extends FinTable>(table: K, values: Partial<TableMap[K]> & { id?: string }) => {
      const col = cols[table] as unknown as { insert: (v: Partial<TableMap[K]>) => Promise<TableMap[K]>; update: (id: string, v: Partial<TableMap[K]>) => Promise<TableMap[K]>; data: TableMap[K][] };
      if (values.id) {
        const before = col.data.find((r) => (r as { id: string }).id === values.id) as unknown as Record<string, unknown> | undefined;
        const { id, ...patch } = values;
        const after = await col.update(id, patch as Partial<TableMap[K]>);
        await log({ table_name: table, record_id: id, action: "alterou", summary: `Alterou ${TABLE_LABEL[table]}: ${describe(table, after as unknown as Record<string, unknown>)}`, before: snapshot(before), after: snapshot(after as unknown as Record<string, unknown>) });
        return after;
      }
      const row = await col.insert(values);
      await log({ table_name: table, record_id: (row as { id: string }).id, action: "criou", summary: `Criou ${TABLE_LABEL[table]}: ${describe(table, row as unknown as Record<string, unknown>)}`, after: snapshot(row as unknown as Record<string, unknown>) });
      return row;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, contracts, recurring, reserves, balances, plans, log],
  );

  const remove = useCallback(
    async (table: FinTable, id: string) => {
      const col = cols[table] as unknown as { remove: (id: string) => Promise<void>; data: Array<{ id: string }> };
      const before = col.data.find((r) => r.id === id) as unknown as Record<string, unknown> | undefined;
      await col.remove(id);
      await log({ table_name: table, record_id: id, action: "excluiu", summary: `Excluiu ${TABLE_LABEL[table]}: ${describe(table, before)}`, before: snapshot(before) });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, contracts, recurring, reserves, balances, plans, log],
  );

  /** Grava vários registros de uma vez (importação), com uma entrada no histórico. */
  const saveMany = useCallback(
    async <K extends TableName>(table: K, rows: Partial<TableMap[K]>[], summary: string) => {
      if (!rows.length) return;
      await store.insertMany(table, rows);
      bump(table);
      await log({ table_name: table, action: "importou", summary });
    },
    [store, bump, log],
  );

  const saveSettings = useCallback(
    async (patch: Partial<FinanceSettings>, summary = "Alterou configurações financeiras") => {
      const next = { ...settings, ...patch };
      await store.saveProfile({ finance_settings: next });
      await refreshProfile();
      await log({ table_name: "finance_settings", action: "configurou", summary, before: null, after: patch as Record<string, unknown> });
    },
    [settings, store, refreshProfile, log],
  );

  return { loading, data, analysis, settings, today, patients: patients.data, save, remove, saveMany, saveSettings, log, store };
}

export type UseFinance = ReturnType<typeof useFinance>;
