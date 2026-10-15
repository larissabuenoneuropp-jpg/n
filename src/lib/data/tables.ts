import type { TableName } from "@/lib/types";

/** Todas as tabelas do app — usada pelos stores (backup/exportação) e pelo provider (recarga). */
export const ALL_TABLES: TableName[] = [
  "patients", "assessments", "intervention_plans", "appointments", "session_records",
  "activities", "documents", "transactions", "reports", "instruments", "assessment_records", "receipts", "tasks", "social_posts", "charge_messages",
  "fin_contracts", "fin_recurring", "fin_reserves", "fin_balances", "fin_plans", "fin_history",
];
