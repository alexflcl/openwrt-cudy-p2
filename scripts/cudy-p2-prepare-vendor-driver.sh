#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PCIE_FILE="$ROOT_DIR/feeds/sprdpcie/kernel/sprd-pcie/src/pcie/sprd_pcie_ep_device.c"
MPM_FILE="$ROOT_DIR/feeds/sprdpcie/kernel/sprd-pcie/src/power_manager/power_manager.c"

for file in "$PCIE_FILE" "$MPM_FILE"; do
	[ -f "$file" ] || {
		echo "SPRD PCIe driver source not found: $file" >&2
		exit 1
	}
done

python3 - "$PCIE_FILE" "$MPM_FILE" <<'PY'
from pathlib import Path
import re
import sys

pcie_path = Path(sys.argv[1])
mpm_path = Path(sys.argv[2])

pcie = pcie_path.read_text()
pcie_patterns = [
    r'\n\s*dev_dbg\(dev, "ep: irq handler\. irq = 0x%x, base=%d\\n", value,\s*ep_dev->base_irq\);\n',
    r'\n\s*dev_dbg\(dev, "ep: irq handler\. irq = %d\\n", irq\);\n',
    r'\n\s*dev_dbg\(dev, "ep: raise, ep=%d, irq=%d\\n", ep, irq\);\n',
]
pcie_updated = pcie
pcie_count = 0
for pattern in pcie_patterns:
    pcie_updated, replacements = re.subn(pattern, '\n', pcie_updated)
    pcie_count += replacements

# The vendor power manager emits a debug line for every normal wake/sleep
# transition. Keep warnings/errors but remove these high-frequency traces.
mpm = mpm_path.read_text()
mpm_updated, mpm_count = re.subn(
    r'\n\s*pr_debug\("mpm:.*?\);\n',
    '\n',
    mpm,
    flags=re.DOTALL,
)

if pcie_count == 0 and mpm_count == 0:
    raise SystemExit("No known PCIe debug statements matched; update the helper before building")

pcie_path.write_text(pcie_updated)
mpm_path.write_text(mpm_updated)
print(f"Removed {pcie_count} PCIe and {mpm_count} power-manager debug statements")
PY
