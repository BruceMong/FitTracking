#!/usr/bin/env bash
# Banc d'essai SQL jetable : rejoue le schéma (et la migration) dans un postgres:17 sans port publié.
# Usage : lancer.sh [--schema-seul | --ancien-schema | --rejeu]
#   --schema-seul    : schema.sql actuel seul (il doit se suffire)
#   --ancien-schema  : schema d'avant la montre (commit 4adbb12) + la migration : le chemin de la production
#   --rejeu          : schema.sql actuel + la migration rejouée par-dessus (elle ne doit rien casser)
#   sans option      : les trois, à la suite ; imprime « tests SQL : OK » seulement si tout passe.
set -euo pipefail
ici="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
supabase="$(dirname "$ici")"
avant_montre=4adbb12
migration="$supabase/migrations/2026-11-09-montre.sql"

mode="${1:-tout}"
if [ "$mode" = tout ]; then
  for m in --schema-seul --ancien-schema --rejeu; do
    echo "== $m"
    "${BASH_SOURCE[0]}" "$m"
  done
  echo "tests SQL : OK"
  exit 0
fi

nom="carnet-essai-$$"
docker run -d --rm --name "$nom" -e POSTGRES_PASSWORD=essai postgres:17 >/dev/null
trap 'docker rm -f "$nom" >/dev/null 2>&1 || true' EXIT

# Le point d'entrée démarre, initialise, puis redémarre le serveur : attendre la fin de l'init
# (log capturé dans une variable : pas de SIGPIPE de grep -q sous pipefail), puis le serveur prêt.
pret=0
for _ in $(seq 1 120); do
  journal="$(docker logs "$nom" 2>&1 || true)"
  if grep -q 'PostgreSQL init process complete' <<<"$journal" && docker exec "$nom" pg_isready -U postgres -q; then
    pret=1
    break
  fi
  sleep 0.5
done
journal="$(docker logs "$nom" 2>&1 || true)"
if [ "$pret" != 1 ] || ! grep -q 'PostgreSQL init process complete' <<<"$journal"; then
  echo "le conteneur n'a pas fini son initialisation" >&2
  exit 1
fi

jouer() { docker exec -i "$nom" psql -U postgres -v ON_ERROR_STOP=1 -q; }

jouer < "$ici/roles.sql"
case "$mode" in
  --schema-seul)   jouer < "$supabase/schema.sql" ;;
  --ancien-schema) git -C "$supabase" show "$avant_montre:supabase/schema.sql" | jouer
                   jouer < "$migration" ;;
  --rejeu)         jouer < "$supabase/schema.sql"
                   jouer < "$migration" ;;
  *) echo "option inconnue : $mode" >&2; exit 2 ;;
esac
jouer < "$ici/montre.sql"
echo "tests SQL ($mode) : OK"
