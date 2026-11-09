#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="/usr/bin:$PATH"

echo "=== Building Seanime Denshi Client (Linux) ==="
echo "Workspace: $DIR"

echo "1/4: Building Frontend (web-denshi)..."
cd "$DIR/seanime-web"
npm run build:denshi

echo "2/4: Staging web-denshi into desktop client..."
rm -rf "$DIR/seanime-denshi/web-denshi"
cp -r "$DIR/seanime-web/out-denshi" "$DIR/seanime-denshi/web-denshi"

echo "3/4: Compiling Electron Main Process & syncing mpv-prism..."
cd "$DIR/seanime-denshi"
mkdir -p "$DIR/seanime-denshi/binaries"
npm run build:main
npm run sync:mpv-prism -- linux-x64

echo "4/4: Packaging Linux Client..."
npm run build:linux

echo "=== Build Complete! ==="
echo "Linux package is available in: $DIR/seanime-denshi/dist"
