sap.ui.define([
	"./BaseController", "sap/ui/model/json/JSONModel", "sap/m/MessageToast"
], function (BaseController, JSONModel, MessageToast) {
	"use strict";

	var WORKMODE_INDEPENDENT = "Independent";
	var WORKMOD_FUTUREWE = "AutomaticFutureWE";

	return BaseController.extend("de.arvato.GRModul10.controller.Main", {

		onInit: function () {

			this.getOwnerComponent().setController(this);

			this.initMessageManager();
			this.getView().onAfterRendering = this._onAfterRenderingView.bind(this);

			// HomeButton abfangen!
			var oHomeBtn = sap.ui.getCore().byId("homeBtn");
			if (oHomeBtn ) {
				this._onPressHomeBtn = this.onPressHomeBtn.bind(this);
				oHomeBtn.attachPress(this._onPressHomeBtn);
				var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
				oRouter.attachRouteMatched(this.attachRouteMatched.bind(this));
			}
		},

		onPressHomeBtn: function (oEvent) {

			var sCurrentRoute = this.getModel("app").getProperty("/CurrentRoute");

			this.handleAbort({
				Tanum: this.getModel("app").getProperty("/Data/Tanum"),
				Text: this.getResourceBundle().getText("General.GoToHome", [sCurrentRoute])
			});

			// 	var sCurrentRoute = this.getModel("app").getProperty("/CurrentRoute");
			// 	var aRelevantRoutes = ["RouteSumCheck", "RouteSampleCheck", "RouteFractureCheck"];
			// 	if (aRelevantRoutes.indexOf(sCurrentRoute) > -1) {
			// 		var oQuant = {
			// 			Client: this.getModel("app").getProperty("/Data/Client"),
			// 			Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
			// 			Wenum: this.getModel("app").getProperty("/Data/Tanum")
			// 		};

			// 		this.findQuant(oQuant).then(function (aValues) {
			// 			var oWHQuant = aValues.results.length > 0 ? aValues.results[0] : null;
			// 			oWHQuant.Skzua = "X";
			// 			oWHQuant.Spgru = "7";
			// 			if (oWHQuant) {
			// 				this.updateQuant(oWHQuant);
			// 			}
			// 		}.bind(this));

			// 		this.writeGRErrorLog({
			// 			Tanum: this.getModel("app").getProperty("/Data/Tanum"),
			// 			Text: this.getResourceBundle().getText("General.GoToHome", [sCurrentRoute])
			// 		});
			// 	}

			oEvent.getSource().detachPress(this._onPressHomeBtn);
			oEvent.preventDefault();
		},

		_onAfterRenderingView: function (oEvent) {

			// Erstman wird von Default-Modus ausgegangen!
			var sWorkMode = this.getWorkMode();
			this.setWorkMode(sWorkMode);

			switch (sWorkMode) {
			case WORKMODE_INDEPENDENT:
				var oScanButton = this.byId("idScanButton");
				if (oScanButton) {
					oScanButton._onPress();
				}
				this.clearViewContext(this.getView().getViewName());
				break;
			case WORKMOD_FUTUREWE:
				var oParams = this.convertStartupParameters(this.getOwnerComponent().getComponentData().startupParameters);
				this.setStartupParameters(oParams);
				this.getModel("app").setProperty("/Employee/ID", oParams.EmployeeID);
				this.getModel("app").setProperty("/Employee/Name", oParams.EmployeeName);
				this.getModel("app").setProperty("/Data/Tanum", oParams.Tanum);
				var oInputTanum = this.getView().byId("idTanumInput");
				// Leider noch ein Sonderprozess! Erst Bruch-TA behandeln, danach den Korrekten.
				oInputTanum.fireEvent("submit", {
					value: oParams.TanumBruch ? oParams.TanumBruch : oParams.Tanum
				});
				break;
			default:
			}
		},

		onEmployeeInputSuccess: function (oEvent) {

			var sEmployeeIdent = oEvent.getParameter("value");
			this.readEmployee(sEmployeeIdent).then(
				function (oData) {
					var sName, sUser, sLgnum;

					if (oData.results.length === 1) {
						var oResult = oData.results[0];
						if (oResult) {
							sName = oResult.Address.Lastname + ", " + oResult.Address.Firstname;
							sUser = oResult.Username;
							sLgnum = oResult.Lgnum;
						} else {
							MessageToast.show(this.getResourceBundle().getText("Main.EmployeeBarcodeMustBeScaned"), {
								at: "center center"
							});
						}
					} else {
						MessageToast.show(this.getResourceBundle().getText("Main.EmployeeBarcodeMustBeScaned"), {
							at: "center center"
						});
					}

					// Falls Ident nicht erkannt wurde, Wert auf undefined setzen!
					this.getModel("app").setProperty("/Employee/Name", sName);
					this.getModel("app").setProperty("/Employee/User", sUser);
					this.getModel("app").setProperty("/Employee/Lgnum", sLgnum);

					this.getView().byId("idTanumInput").focus();

				}.bind(this),
				function (oError) {
					MessageToast.show(this.getMessageErrorValue(oError), {
						at: "center center"
					});
				});
		},

		onTanumSubmit: function (oTanumSubmitEvent) {

			var sTanum = oTanumSubmitEvent.getParameter("value");
			if (sTanum.length > 10) {
				sTanum = sTanum.substr(3, 10);
			}

			this.readDocHU(sTanum).then(
				function (oData) {
					if (oData.results.length === 1) {

						var oDocHU = oData.results[0];
						if (oDocHU.TransferOrder && oDocHU.TransferOrder.Werks) {
							this.getModel("app").setProperty("/Data/Werks", oDocHU.TransferOrder.Werks);
						}

						//this.setInitialData(oDocHU);
						var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

						if (oDocHU.Bruch === "") {
							oRouter.navTo("RouteSumCheck", {
								huId: oDocHU.HuId
							});
						} else {
							oRouter.navTo("RouteFractureCheck", {
								huId: oDocHU.HuId
							});
						}

					} else {
						var sMessage = this.getResourceBundle().getText("Message.TONotFound", [sTanum]);
						sap.ui.getCore().getMessageManager().addMessages(this.getMessage("Error", sMessage));
					}
				}.bind(this),
				function (oError) {

				}.bind(this));
		}
	});
});