#!/usr/bin/env bash
# Testa as migrações (instalacao-completa.sql) e as regras de segurança do banco num PostgreSQL local.
# Uso: DATABASE_URL=postgres://usuario:senha@localhost:5432/postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
URL="${DATABASE_URL:?defina DATABASE_URL}"
DB="np_test_$$"
psql "$URL" -qc "create database $DB"
trap 'psql "$URL" -qc "drop database if exists $DB" >/dev/null' EXIT
TEST_URL="${URL%/*}/$DB"
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/tests/00_stub_supabase.sql >/dev/null
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/instalacao-completa.sql 2>&1 | grep -v NOTICE || true
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/migrations/0007_security_hardening.sql 2>&1 | grep -v NOTICE || true # deve poder rodar 2x
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f supabase/migrations/0008_gestao_financeira.sql 2>&1 | grep -v NOTICE || true # idem
OUT=$(psql "$TEST_URL" -At -F ' | ' -f supabase/tests/10_seguranca.sql | grep -E '^(OK|FAIL)')
echo "$OUT"
if echo "$OUT" | grep -q '^FAIL'; then echo "Falhou"; exit 1; fi
echo "Todos os testes do banco passaram."
