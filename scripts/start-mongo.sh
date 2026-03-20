#!/usr/bin/env bash
# Levanta MongoDB local con Docker (desde la raíz del repo: ./scripts/start-mongo.sh)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "No está instalado Docker. Instalalo desde https://www.docker.com/products/docker-desktop/"
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker no responde. Abrí Docker Desktop y esperá a que diga \"running\", luego ejecutá de nuevo:"
  echo "  ./scripts/start-mongo.sh"
  exit 1
fi

docker compose up -d
echo ""
echo "MongoDB listo en mongodb://localhost:27017"
docker compose ps
echo ""
echo "Siguiente: en backend/.env tenés MONGO_URL=mongodb://localhost:27017"
echo "Reiniciá el backend: cd backend && source .venv/bin/activate && uvicorn server:app --reload --host 127.0.0.1 --port 8000"
