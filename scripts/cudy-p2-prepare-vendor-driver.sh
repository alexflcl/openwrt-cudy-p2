#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
TOPDIR="$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)"
FEED_ROOT="${1:-$TOPDIR/feeds/jell/quectel_SRPD_PCIE}"
PATCH_FILE="$TOPDIR/vendor-patches/quectel_SRPD_PCIE/001-silence-sprd-pcie-irq-logspam.patch"
TARGET_FILE="$FEED_ROOT/src/pcie/sprd_pcie_ep_device.c"

if [ ! -d "$FEED_ROOT" ]; then
  echo "Feed package not found: $FEED_ROOT" >&2
  echo "Run ./scripts/feeds update jell and ./scripts/feeds install -p jell sprd_pcie first." >&2
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo "Target source file not found: $TARGET_FILE" >&2
  exit 1
fi

if ! grep -q 'ep: irq handler. irq = 0x%x, base=%d' "$TARGET_FILE" && \
   ! grep -q 'ep: irq handler. irq = %d' "$TARGET_FILE"; then
  echo "sprd_pcie IRQ log spam patch already present or source layout changed."
  exit 0
fi

patch --forward -p1 -d "$FEED_ROOT" < "$PATCH_FILE"
echo "Applied sprd_pcie IRQ log spam patch in $FEED_ROOT"
