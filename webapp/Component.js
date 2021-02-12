sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"de/arvato/GRModul10/model/models"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("de.arvato.GRModul10.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {

			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// enable routing
			this.getRouter().initialize();

			// set the device model
			this.setModel(models.createDeviceModel(), "device");
		},

		// destroy: function () {
		// 	//this._oErrorHandler.destroy();
		// 	this.writeForAbortOption();
		// 	// call the base component's destroy function
		// 	UIComponent.prototype.destroy.apply(this, arguments);
		// },

		setController: function (oController) {
			this._oController = oController;
		},

		// writeForAbortOption: function () {

		// 	var sCurrentRoute = this.getModel("app").getProperty("/CurrentRoute");
		// 	var oQuant = {
		// 		Client: this.getModel("app").getProperty("/Data/Client"),
		// 		Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
		// 		Wenum: this.getModel("app").getProperty("/Data/Tanum")
		// 	};

		// 	this._oController.findQuant(oQuant).then(function (aValues) {
		// 		var oWHQuant = aValues.results.length > 0 ? aValues.results[0] : null;
		// 		oWHQuant.Skzua = "X";
		// 		oWHQuant.Spgru = "7";
		// 		if (oWHQuant) {
		// 			this.updateQuant(oWHQuant);
		// 		}
		// 	}.bind(this._oController));

		// 	this._oController.writeGRErrorLog({
		// 		Tanum: this.getModel("app").getProperty("/Data/Tanum"),
		// 		Text: this._oController.getResourceBundle().getText("General.GoToHome", [sCurrentRoute])
		// 	});
		// }
	});
});