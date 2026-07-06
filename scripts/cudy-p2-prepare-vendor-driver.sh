#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_FILES="
$ROOT_DIR/quectel_SRPD_PCIE/src/pcie/sprd_pcie_ep_device.c
$ROOT_DIR/package/feeds/sprdpcie/quectel_SRPD_PCIE/src/pcie/sprd_pcie_ep_device.c
$ROOT_DIR/feeds/sprdpcie/quectel_SRPD_PCIE/src/pcie/sprd_pcie_ep_device.c
"

FOUND=0

for TARGET_FILE in $TARGET_FILES; do
	[ -f "$TARGET_FILE" ] || continue
	FOUND=1
	python3 - "$TARGET_FILE" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
text = path.read_text()
needles = [
    'dev_dbg(dev, "ep: irq handler. irq = 0x%x, base=%d\\n", value, ep_dev->base_irq);\\n',
    'dev_dbg(dev, "ep: irq handler. irq = %d\\n",  irq);\\n',
]
updated = text
for needle in needles:
    updated = updated.replace(needle, "")

if updated != text:
    path.write_text(updated)
    print(f"Patched log spam in {path}")
else:
    print(f"No log-spam lines found in {path}")
PY
done

if [ "$FOUND" -eq 0 ]; then
	echo "quectel_SRPD_PCIE source not found in expected locations" >&2
	exit 0
fi
