#!/usr/bin/env bash
# Prepara as fotos para a web: corrige a rotação, remove metadados (incluindo localização GPS),
# limita a 1600 px de largura e gera versões WebP de 800 e 1400 px.
# Requer ImageMagick (comando "convert"). Uso, a partir da pasta site/:
#   ./otimizar-fotos.sh
# Lê as originais em fotos-originais/ e grava as versões otimizadas em src/img/fotos/.
set -euo pipefail
cd "$(dirname "$0")"

origem="fotos-originais"
destino="src/img/fotos"
mkdir -p "$destino"

shopt -s nullglob nocaseglob
arquivos=("$origem"/*.jpg "$origem"/*.jpeg "$origem"/*.png "$origem"/*.heic)
if [ ${#arquivos[@]} -eq 0 ]; then
  echo "Nenhuma foto em $origem/. Coloque lá as fotos com os nomes indicados no README."
  exit 1
fi

for f in "${arquivos[@]}"; do
  nome="$(basename "${f%.*}")"
  convert "$f" -auto-orient -strip -resize '1600x>' -sampling-factor 4:2:0 -interlace JPEG -quality 82 "$destino/$nome.jpg"
  largura=$(identify -format "%w" "$destino/$nome.jpg")
  for w in 800 1400; do
    # só gera a cópia se a original for maior (senão o tamanho declarado no site seria falso)
    if [ "$largura" -gt "$w" ]; then
      convert "$destino/$nome.jpg" -resize "${w}x" -quality 78 "$destino/$nome-$w.webp"
    fi
  done
  echo "ok  $nome  ($(du -h "$destino/$nome.jpg" | cut -f1) jpg)"
done
