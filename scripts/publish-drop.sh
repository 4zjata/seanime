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

echo "==> Uploading $(basename "${PKG}") to up.voidy.xyz..."
UPLOAD_URL=$(curl -s -F "file=@${PKG}" -H "x-access-key: jE4alVd6jHgdUU7sUVUSv4ah" http://127.0.0.1:24424)

if [[ "${UPLOAD_URL}" != http* ]]; then
    echo "Upload failed: ${UPLOAD_URL}"
    exit 1
fi

UPLOAD_URL=$(echo "${UPLOAD_URL}" | tr -d '\r\n')
echo "    Uploaded package URL: ${UPLOAD_URL}"

echo "==> Updating paste 'seanime' at up.voidy.xyz/p/seanime..."

UPDATER_SCRIPT=$(cat << EOF
#!/usr/bin/env bash
set -euo pipefail

echo "============================================="
echo "   Updating Seanime Denshi Remote Client     "
echo "============================================="

echo "-> Closing running instances..."
killall -9 seanime-denshi 2>/dev/null || true

PKG_URL="${UPLOAD_URL}"
TMP_PKG="/tmp/seanime-denshi-client.pkg.tar.zst"

echo "-> Downloading latest client package..."
curl -#SL "\${PKG_URL}" -o "\${TMP_PKG}"

echo "-> Installing package with pacman..."
sudo pacman -U --noconfirm "\${TMP_PKG}"

echo "-> Cleaning up..."
rm -f "\${TMP_PKG}"

echo ""
echo "==> Done! You can now launch Seanime Denshi."
EOF
)

docker exec -i voidydrop bun -e "
import { Database } from 'bun:sqlite';
const db = new Database('/app/data/data.sqlite');
const script = await Bun.stdin.text();
db.query(\`
  INSERT INTO pastes (id, content, language, created_at, views, key_id, burn_after_reading)
  VALUES ('seanime', ?, 'bash', ?, 0, 'jE4alVd6jHgdUU7sUVUSv4ah', 0)
  ON CONFLICT(id) DO UPDATE SET content = excluded.content, created_at = excluded.created_at;
\`).run(script, Date.now());
" <<< "${UPDATER_SCRIPT}"

echo ""
echo "====================================================================="
echo " Paste updated! Universal client updater command:"
echo ""
echo "   curl -sL up.voidy.xyz/p/seanime | bash"
echo ""
echo " Direct script URL: https://up.voidy.xyz/p/seanime"
echo " Raw package URL:   ${UPLOAD_URL}"
echo "====================================================================="
echo ""
