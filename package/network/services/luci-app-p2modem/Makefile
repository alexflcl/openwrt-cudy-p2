include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-p2modem
PKG_RELEASE:=3

LUCI_TITLE:=LuCI support for Cudy P2 PCIe modem control
LUCI_DEPENDS:=+luci-base +luci-mod-network +luci-lib-base +firewall4 +kmod-sprd-pcie +kmod-usb-serial-option
LUCI_PKGARCH:=all

include $(TOPDIR)/feeds/luci/luci.mk
