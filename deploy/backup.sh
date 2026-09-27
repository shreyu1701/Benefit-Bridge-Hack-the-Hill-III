#!/bin/sh
# Nightly database backup, keeps 14 days. Install on the server with:
#   (crontab -l 2>/dev/null; echo "15 3 * * * cd $HOME/benefit-bridge && sh deploy/backup.sh >> deploy/backups/backup.log 2>&1") | crontab -
set -eu
cd "$(dirname "$0")/.."
mkdir -p deploy/backups
f="deploy/backups/benefit_bridge-$(date +%Y%m%d-%H%M).sql.gz"
docker compose exec -T db pg_dump -U benefit_bridge benefit_bridge | gzip > "$f"
find deploy/backups -name '*.sql.gz' -mtime +14 -delete
echo "$(date -Is) backup written: $f"
