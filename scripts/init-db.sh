#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
docker compose up -d --wait mysql redis
for file in database/schema.sql database/phase2.sql database/seed.sql database/images.sql database/inventory.sql; do
  docker compose exec -T mysql sh -c 'MYSQL_PWD="$MYSQL_PASSWORD" exec mysql --default-character-set=utf8mb4 -u"$MYSQL_USER" "$MYSQL_DATABASE"' < "$file"
done
printf 'WeBox database initialized. Existing rows were preserved.
'
