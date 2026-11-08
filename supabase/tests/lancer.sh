#!/usr/bin/env bash
# Banc d'essai SQL jetable : rejoue schema.sql (et la migration) dans un postgres:17 sans port publié.
# Usage : lancer.sh [--schema-seul]   (sans la migration, pour vérifier que schema.sql se suffit)
set -euo pipefail
ici="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
supabase="$(dirname "$ici")"
nom="carnet-essai-$$"

docker run -d --rm --name "$nom" -e POSTGRES_PASSWORD=essai postgres:17 >/dev/null
trap 'docker rm -f "$nom" >/dev/null 2>&1 || true' EXIT

# Le point d'entrée démarre, initialise, puis redémarre le serveur : attendre la fin de l'init.
for _ in $(seq 1 120); do
  if docker logs "$nom" 2>&1 | grep -q 'PostgreSQL init process complete' \
     && docker exec "$nom" pg_isready -U postgres -q; then
    break
  fi
  sleep 0.5
done
docker exec "$nom" pg_isready -U postgres -q

jouer() { docker exec -i "$nom" psql -U postgres -v ON_ERROR_STOP=1 -q < "$1"; }

jouer "$ici/roles.sql"
jouer "$supabase/schema.sql"
if [ "${1:-}" != "--schema-seul" ] && [ -f "$supabase/migrations/2026-11-09-montre.sql" ]; then
  jouer "$supabase/migrations/2026-11-09-montre.sql"
fi
jouer "$ici/montre.sql"
echo "tests SQL : OK"
