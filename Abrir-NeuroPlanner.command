#!/bin/bash
# Abre o NeuroPlanner SÓ neste computador (Mac). Dê dois cliques neste arquivo.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "O Node.js não está instalado. Instale a versão 22 LTS em https://nodejs.org e abra este arquivo de novo."
  echo ""
  read -r -p "Pressione Enter para fechar."
  exit 1
fi
node scripts/local.mjs
