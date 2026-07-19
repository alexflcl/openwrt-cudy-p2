include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-p2modem
PKG_RELEASE:=5
PKG_LICENSE:=Apache-2.0
PKG_MAINTAINER:=alexflcl
PKGARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-p2modem
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI support for Cudy P2 PCIe modem control
  DEPENDS:=+luci-base +luci-mod-network +firewall4 +kmod-sprd-pcie +kmod-usb-serial-option
endef

define Package/luci-app-p2modem/description
LuCI management and PCIe-only startup support for the internal Cudy P2 modem.
endef

define Build/Compile
endef

define Package/luci-app-p2modem/install
	$(INSTALL_DIR) $(1)/
	$(CP) ./root/* $(1)/
	$(INSTALL_DIR) $(1)/usr/bin $(1)/etc/init.d $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/usr/bin/p2modemctl $(1)/usr/bin/p2modemctl
	$(INSTALL_BIN) ./root/usr/bin/p2smsd $(1)/usr/bin/p2smsd
	$(INSTALL_BIN) ./root/etc/init.d/p2modem $(1)/etc/init.d/p2modem
	$(INSTALL_BIN) ./root/etc/init.d/p2smsd $(1)/etc/init.d/p2smsd
	$(INSTALL_BIN) ./root/etc/uci-defaults/99-p2modem-enable $(1)/etc/uci-defaults/99-p2modem-enable
	$(INSTALL_DIR) $(1)/www
	$(CP) ./htdocs/* $(1)/www/
endef

$(eval $(call BuildPackage,luci-app-p2modem))
