#!/usr/bin/env bash
set -euo pipefail

SYNC_KEY="${1:-nipponhomesListingsSync}"

echo "Pausing $SYNC_KEY"
ntn workers sync pause "$SYNC_KEY"

echo "Resetting state for $SYNC_KEY"
ntn workers sync state reset "$SYNC_KEY"

echo "Resuming $SYNC_KEY"
ntn workers sync resume "$SYNC_KEY"

echo "Triggering $SYNC_KEY"
ntn workers sync trigger "$SYNC_KEY"

echo "Current status"
ntn workers sync status "$SYNC_KEY" --no-watch
