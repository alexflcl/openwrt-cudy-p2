#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
TARGET_FILE="$ROOT_DIR/feeds/sprdpcie/kernel/sprd-pcie/src/pcie/sprd_pcie_ep_device.c"

[ -f "$TARGET_FILE" ] || {
	echo "SPRD PCIe driver source not found: $TARGET_FILE" >&2
	exit 1
}

python3 - "$TARGET_FILE" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()
patterns = [
    r'\n\s*dev_dbg\(dev, "ep: irq handler\. irq = 0x%x, base=%d\\n", value,\s*ep_dev->base_irq\);\n',
    r'\n\s*dev_dbg\(dev, "ep: irq handler\. irq = %d\\n", irq\);\n',
]
updated = text
count = 0
for pattern in patterns:
    updated, replacements = re.subn(pattern, '\n', updated)
    count += replacements

if count == 0:
    raise SystemExit("No IRQ log-spam statements matched; update the helper before building")

path.write_text(updated)
print(f"Removed {count} PCIe IRQ debug statements from {path}")
PY
