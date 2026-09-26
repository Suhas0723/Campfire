#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example"
  echo "Set SITE_ADDRESS, PUBLIC_APP_URL, SECRET_KEY, and provider keys before starting."
fi
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build "$@"
