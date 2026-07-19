# OpenWrt Cudy P2 v1 - PCIe 5G build

Custom OpenWrt build for **Cudy P2 v1** with the internal Quectel 5G modem operating through PCIe.

> [!WARNING]
> This is an experimental community build for one exact hardware revision: **Cudy P2 v1**. It is not an official Cudy or OpenWrt image. Flashing can make the router inaccessible and may require UART recovery. Do not use it on a different Cudy model or hardware revision.

## Download

The current firmware is published in this repository's [Releases](../../releases).

Until the release asset is published, use the successful GitHub Actions artifact:

- [Firmware build #29676743756](../../actions/runs/29676743756)
- Artifact: `cudy-p2-firmware`
- Build commit: `c1d77b7ce3b9c1203432c5deebb1d092db66a942`
- Artifact digest: `sha256:06b09d2c80b2dc02f8fca855f9bad942db3cc6ad4631a7de97856b6f29712aea`

For an already-running OpenWrt P2 installation, use only:

`*-cudy_p2-v1-squashfs-sysupgrade.bin`

The `*-initramfs-kernel.bin` image is for RAM boot/recovery workflows, not normal LuCI upgrades.

## Features

- PCIe-only internal 5G modem support via `kmod-sprd-pcie`.
- P2 Modem LuCI page: APN, PDP type, 4G/5G/auto preference and WAN priority.
- Correct physical network defaults: one `LAN` port and one `WAN` port.
- LAN DNS defaults: `1.1.1.1` and `8.8.8.8`.
- SIM startup over PCIe, without the unsafe modem-wide `AT+CFUN=1,1` reset.
- SMS inbox in LuCI, cached in RAM, automatic low-frequency sync and per-message deletion.
- SIM phone-number display when the SIM exposes its MSISDN.
- Reduced normal PCIe debug-log noise while retaining warnings and errors.

## Installation

Read [the installation guide](docs/INSTALL.md) before flashing.

## Build

The GitHub Actions workflow builds the complete image automatically when P2-related sources change. See [release notes](docs/RELEASE-v0.1.0.md) for the exact contents of this build.

## Credits

- PCIe modem support: [zekica/openwrt-cudy-p2](https://github.com/zekica/openwrt-cudy-p2) and [zekica/openwrt-sprd-pcie](https://github.com/zekica/openwrt-sprd-pcie).
- Cudy P2 upstream support work: [openwrt/openwrt#23721](https://github.com/openwrt/openwrt/pull/23721).
