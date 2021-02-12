sap.ui.define([
	"./BaseController",
	"sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
	"use strict";

	return BaseController.extend("de.arvato.GRModul10.controller.App", {

		onInit: function () {
			// Bestimmt keine optimale Loesung!
			if (sap.ui.getCore().byId("shell")) {
				sap.ui.getCore().byId("shell").setHeaderHiding(false);
			}
		}
	});
});