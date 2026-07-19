# Installation Guide

## Scope and risk

This guide applies only to **Cudy P2 v1**. It assumes you understand that custom firmware can interrupt access to the router. Keep a UART adapter and physical access available before changing boot firmware.

Do not flash these images onto another Cudy device, another P2 hardware revision, or directly through an unsupported vendor recovery screen.

## Files

A successful build artifact contains:

- `*-cudy_p2-v1-squashfs-sysupgrade.bin`: normal upgrade image for a router already running compatible OpenWrt.
- `*-cudy_p2-v1-initramfs-kernel.bin`: RAM/recovery image. Do not select it for a normal LuCI sysupgrade.
- `*.manifest`, `SHA256SUMS` and the build configuration.

Verify the SHA256 checksum before flashing.

## Migrating from stock Cudy firmware

The stock Cudy web UI does not accept a normal OpenWrt sysupgrade image directly.

1. Obtain Cudy's intermediate signed firmware from the upstream OpenWrt discussion:
   [cudy_p2-v1-sysupgrade_20251127.zip](https://github.com/user-attachments/files/28754679/cudy_p2-v1-sysupgrade_20251127.zip).
2. Read and follow the instructions supplied with that intermediate image exactly.
3. Once the router is running compatible OpenWrt, access LuCI on the LAN port.
4. Upload this project's `*-squashfs-sysupgrade.bin` via **System > Backup / Flash Firmware**.

The intermediate image is supplied by Cudy through an upstream discussion, not by this repository. Its availability and flashing method are outside this project's control.

## Upgrading an existing compatible OpenWrt P2

1. Connect a computer by Ethernet to the physical **LAN** port.
2. Download the `*-squashfs-sysupgrade.bin` file from the release.
3. In LuCI, open **System > Backup / Flash Firmware** and upload the image.
4. For the first install of a new custom build, do **not** retain settings. This avoids carrying incompatible network or package configuration.
5. Confirm the image checksum and start the upgrade.
6. Wait for reboot. Do not remove power during flash.

After reboot, browse to `http://192.168.1.1/`, set a root password and configure the APN in **Network > P2 Modem**.

## First modem connection

1. Insert an active physical SIM.
2. Open **Network > P2 Modem > Configuracion**.
3. Set the carrier APN if it is not already detected.
4. Choose `Automatico` radio mode initially.
5. Save and apply, then use **Connect SIM** if WWAN does not come up automatically.
6. Confirm that the `wwan` interface has an address and default route.

## Recovery

If the router no longer responds on the network, use UART to inspect the boot log and recover. Do not assume that repeated reset-button presses will restore a working image. Record the exact boot output before making further flash changes.

## Known limitations

- The physical router exposes one LAN and one WAN Ethernet port.
- This build does not add an external USB-host port for printers or storage.
- eSIM support depends on hardware eUICC provision on the board or an external SIM-compatible eSIM adapter; it is not enabled merely by this firmware.
