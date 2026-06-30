include $(TOPDIR)/rules.mk

PKG_NAME:=p2modem
PKG_RELEASE:=1

include $(INCLUDE_DIR)/package.mk

define Package/p2modem
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Cudy P2 internal modem integration
  DEPENDS:=+luci-base +luci-mod-network +rpcd +flock +kmod-usb-serial-option +kmod-usb-net-cdc-ether
endef

define Package/p2modem/description
 Integrates the internal modem controls for the Cudy P2, including
 SIM connect or disconnect actions, WAN mode switching and 4G or 5G
 radio preference from LuCI.
endef

define Package/p2modem/conffiles
/etc/config/p2modem
endef

define Build/Compile
endef

define Package/p2modem/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./files/usr/bin/p2modemctl $(1)/usr/bin/p2modemctl
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/etc/init.d/p2modem $(1)/etc/init.d/p2modem
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/p2modem $(1)/etc/config/p2modem
	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/90-cudy-p2-network-sanity $(1)/etc/uci-defaults/90-cudy-p2-network-sanity
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/network
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/network/p2modem.js $(1)/www/luci-static/resources/view/network/p2modem.js
	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./files/usr/share/luci/menu.d/luci-app-p2modem.json $(1)/usr/share/luci/menu.d/luci-app-p2modem.json
	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/usr/share/rpcd/acl.d/luci-app-p2modem.json $(1)/usr/share/rpcd/acl.d/luci-app-p2modem.json
endef

$(eval $(call BuildPackage,p2modem))
