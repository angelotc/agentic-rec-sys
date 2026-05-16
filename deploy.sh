#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-/tmp/agentic-recommendation-system-deploy-copy}"
NODE22_DIR="${NODE22_DIR:-/home/anjo/.nvm/versions/node/v22.9.0/bin}"

if [[ -d "$NODE22_DIR" ]]; then
	export PATH="$NODE22_DIR:$PATH"
fi

node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || true)"
if [[ "$node_major" != "22" ]]; then
	echo "Node 22 is required. Current node: $(node -v 2>/dev/null || echo 'not found')" >&2
	echo "Set NODE22_DIR to a Node 22 bin directory, or put Node 22 first in PATH." >&2
	exit 1
fi

echo "Preparing deploy copy at $DEPLOY_DIR"
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

cp "$ROOT_DIR/package.json" "$DEPLOY_DIR/"
cp "$ROOT_DIR/package-lock.json" "$DEPLOY_DIR/"
cp "$ROOT_DIR/tsconfig.json" "$DEPLOY_DIR/"
cp "$ROOT_DIR/workers.json" "$DEPLOY_DIR/"
cp -R "$ROOT_DIR/src" "$DEPLOY_DIR/"

cd "$DEPLOY_DIR"

echo "Installing dependencies with $(node -v) / npm $(npm -v)"
npm install

echo "Type-checking"
npm run check

echo "Deploying worker"
ntn workers deploy --local-build --no-git
