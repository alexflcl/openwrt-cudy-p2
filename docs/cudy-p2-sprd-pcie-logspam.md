# Cudy P2 `sprd_pcie` IRQ log spam

This repository branch includes a helper workflow for silencing the repeated:

- `sprd-pcie-ep-device ... ep: irq handler. irq = 0x...`
- `sprd-pcie-ep-device ... ep: irq handler. irq = ...`

These messages come from Quectel's vendor `quectel_SRPD_PCIE` package, source file:

- `src/pcie/sprd_pcie_ep_device.c`

## Why a helper script is used

The vendor package uses a custom `Build/Prepare` step that copies local `src/*`
into the kernel build directory. Because of that, dropping a normal OpenWrt
package patch into the feed package is not enough unless the source tree inside
`feeds/jell/quectel_SRPD_PCIE` is patched first.

This branch therefore includes:

- `vendor-patches/quectel_SRPD_PCIE/001-silence-sprd-pcie-irq-logspam.patch`
- `scripts/cudy-p2-prepare-vendor-driver.sh`

## Typical usage

```sh
./scripts/feeds update jell
./scripts/feeds install -p jell sprd_pcie
./scripts/cudy-p2-prepare-vendor-driver.sh
make menuconfig
make -j$(nproc)
```

## Upstream source reference

The vendor package was located in:

- `kenzok8/jell`
- package path: `quectel_SRPD_PCIE`
- checked against branch `main` commit `fe016c6291cbd27d677c40c0ecb8295057f14374`
