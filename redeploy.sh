#!/bin/bash
set -e  # stop on first error

echo "🧹 Bringing down running containers..."
docker compose down

echo "⬇️  Pulling latest code..."
git pull

echo "🔧 Building containers..."
docker compose build

echo "🚀 Starting containers in detached mode..."
docker compose up -d

echo "📜 Attaching logs (Ctrl+C to detach)"
docker compose logs -f