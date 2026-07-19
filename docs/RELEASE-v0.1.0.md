# Release v0.1.0-p2modem

Build commit: `c1d77b7ce3b9c1203432c5deebb1d092db66a942`

## Included

- Cudy P2 v1 board configuration with correct physical LAN/WAN layout.
- PCIe Quectel modem support through `kmod-sprd-pcie`.
- P2 Modem LuCI management for APN, PDP, WAN priority and 4G/5G/automatic radio preference.
- Robust SIM connection path that configures PCIe Ethernet/NAT without issuing `AT+CFUN=1,1`.
- Default LAN DNS servers: `1.1.1.1` and `8.8.8.8`.
- SMS inbox:
  - cached only in RAM;
  - checks the small SIM message counter every 30 seconds;
  - refreshes the full inbox only when that count changes;
  - shows sender, date, preview and full message;
  - allows explicit per-message deletion.
- SIM phone-number display when exposed by `AT+CNUM`.
- Selective suppression of repetitive PCIe debug traces; kernel warnings and errors remain visible.

## Validation performed

- Booted on Cudy P2 v1.
- PCIe WWAN connection obtained with a physical SIM.
- LTE + 5G NSA registration verified.
- LAN/WAN configuration and LAN DNS defaults verified.
- P2 Modem page, SMS cache service and SMS deletion controls installed on a live test router.

## Important

This release is experimental. Read [INSTALL.md](https://github.com/alexflcl/openwrt-cudy-p2/blob/rebuild/p2-firmware-clean/docs/INSTALL.md) before flashing and keep UART recovery equipment available.
