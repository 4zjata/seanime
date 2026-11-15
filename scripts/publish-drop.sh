#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCH_DIR="${REPO_ROOT}/arch"

# Find latest pkg package
PKG=$(ls -t "${ARCH_DIR}"/seanime-denshi-client-[0-9]*.pkg.tar.zst 2>/dev/null | grep -v 'debug' | head -n 1)

if [[ -z "${PKG}" || ! -f "${PKG}" ]]; then
    echo "No built package found in ${ARCH_DIR}. Please run makepkg or ./scripts/build-client.sh first."
    exit 1
fi

echo "Uploading ${PKG} to up.voidy.xyz..."
UPLOAD_URL=$(curl -s -F "file=@${PKG}" -H "x-access-key: jE4alVd6jHgdUU7sUVUSv4ah" http://127.0.0.1:24424)

if [[ "${UPLOAD_URL}" != http* ]]; then
    echo "Upload failed: ${UPLOAD_URL}"
    exit 1
fi

UPLOAD_URL=$(echo "${UPLOAD_URL}" | tr -d '\r\n')

echo ""
echo "====================================================================="
echo " Package uploaded: ${UPLOAD_URL}"
echo "====================================================================="
echo ""
echo "Run this one-liner on your client machine to update:"
echo ""
echo "killall -9 seanime-denshi 2>/dev/null; sudo pacman -U --noconfirm ${UPLOAD_URL}"
echo ""
