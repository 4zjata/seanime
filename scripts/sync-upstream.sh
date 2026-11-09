#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== Syncing Seanime Client with Upstream ==="

if ! git remote get-url upstream 2>/dev/null; then
    echo "Adding upstream remote: https://github.com/5rahim/seanime.git"
    git remote add upstream https://github.com/5rahim/seanime.git
fi

echo "Fetching latest changes from upstream..."
git fetch upstream main

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "Merging upstream/main into $CURRENT_BRANCH..."
git merge upstream/main -m "Merge upstream changes from 5rahim/seanime"

echo "=== Upstream merged successfully! ==="
echo "To rebuild the client with latest upstream updates, run: ./scripts/build-client.sh"
