#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Load .env
if [ ! -f .env ]; then
  echo "No .env file found. Creating from .env.example..."
  cp .env.example .env
  # Generate an API key
  KEY=$(openssl rand -hex 32)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' "s/^MCP_API_KEY=.*/MCP_API_KEY=$KEY/" .env
  else
    sed -i "s/^MCP_API_KEY=.*/MCP_API_KEY=$KEY/" .env
  fi
  echo "Generated MCP_API_KEY in .env"
fi

set -a; source .env; set +a

# Start Postgres if not running
if ! docker compose -f docker-compose.dev.yml ps --status running 2>/dev/null | grep -q postgres; then
  echo "Starting Postgres..."
  docker compose -f docker-compose.dev.yml up -d --wait
else
  echo "Postgres already running."
fi

# Install deps if needed
if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  pnpm install
fi

# Run migrations
echo "Running migrations..."
pnpm db:migrate

# Seed (idempotent)
echo "Seeding database..."
pnpm db:seed

# Start both services
echo ""
echo "Starting Baker Street Tasks..."
echo "  Web:  http://localhost:3000"
echo "  MCP:  http://localhost:${MCP_PORT:-3100}/mcp"
echo "  Key:  ${MCP_API_KEY:0:8}..."
echo ""

pnpm dev:services
