#!/bin/sh
set -eu

fail() {
	echo "ERROR: $*" >&2
	exit 1
}

test ! -e target/linux/mediatek/base-files/lib/preinit/05_set_preinit_iface.rej || fail "patch reject found in preinit"
test ! -e target/linux/mediatek/base-files/lib/preinit/05_set_preinit_iface.orig || fail "patch backup found in preinit"

if find target package scripts -type f \( -name '*.rej' -o -name '*.orig' \) -print -quit | grep -q .; then
	fail "unapplied patch artifacts found in source tree"
fi

grep -q 'cudy,p2-v1)' target/linux/mediatek/base-files/lib/preinit/05_set_preinit_iface || fail "P2 preinit handler missing"
grep -q 'ucidef_set_interfaces_lan_wan lan wan' target/linux/mediatek/filogic/base-files/etc/board.d/02_network || fail "P2 LAN/WAN defaults missing"
grep -q 'CONFIG_PACKAGE_kmod-sprd-pcie=y' configs/cudy-p2-defconfig || fail "SPRD PCIe driver not selected"
grep -q 'CONFIG_PACKAGE_luci-app-p2modem=y' configs/cudy-p2-defconfig || fail "p2modem not selected"

echo 'Cudy P2 source validation passed'
