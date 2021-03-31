sap.ui.define([
	"./BaseController", "sap/ui/core/routing/History",
	"sap/m/MessageBox", "de/arvato/GRModul10/src/Pallet"
], function (BaseController, History, MessageBox, Pallet) {
	"use strict";

	var WORKMODE_INDEPENDENT = "Independent";
	var WORKMOD_FUTUREWE = "AutomaticFutureWE";
	var REPID = "FRACTUREC";

	return BaseController.extend("de.arvato.GRModul10.controller.FractureCheck", {

		onInit: function () {

			this.initMessageManager();
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			oRouter.getRoute("RouteFractureCheck").attachPatternMatched(this._onObjectMatched, this);
		},

		_onObjectMatched: function (oObjectMatchedEvent) {

			var oView = this.getView();
			oView.bindElement({
				path: "/DocHUSet(guid'" + oObjectMatchedEvent.getParameter("arguments").huId + "')",
				model: "erp",
				parameters: {
					expand: "DocItem,CheckSet,CheckSet/RoughGRSet,TransferOrder"
				},
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function (oDataRequestedEvent) {
						oView.setBusy(true);
					},
					dataReceived: this._onDataReceived.bind(this)
				}
			});
		},

		_onBindingChange: function (oBindingChangeEvent) {

			// No data for the binding
			if (!this.getView().getBindingContext("erp")) {
				this.getRouter().getTargets().display("notFound");
			}

			// var oPallet = this.getModel("app").getProperty("/Data/pallet");
			// this.readPallet(oPallet.palId).then(function (oData) {
			// 	oPallet.createContext(oData.results);
			// 	oPallet.createCheckContext();

			// 	if (oPallet.getMacCount() > 0) {
			this.getModel("app").setProperty("/State/FracturePalIDInputEditable", true);
			// 		this.getView().byId("idMacIDInput").focus();
			// 	} else {
			// 		this.getModel("app").setProperty("/State/SerialIDInputEditable", true);
			// 		this.getView().byId("idSerialIDInput").focus();
			// 	}

			// }.bind(this));
		},

		_onDataReceived: function (oDataReceivedEvent) {
			this.getView().setBusy(false);
			this.setInitialData(oDataReceivedEvent.getParameter("data"), false);
		},

		onNavButtonPress: function (oNavButtonPressEvent) {
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

			switch (this.getWorkMode()) {
			case WORKMODE_INDEPENDENT:
				this.clearViewContext();

				var oHistory = History.getInstance();
				var sPreviousHash = oHistory.getPreviousHash();

				if (sPreviousHash !== undefined) {
					window.history.go(-1);
				} else {
					oRouter.navTo("RouteSumCheck", true);
				}
				break;
			case WORKMOD_FUTUREWE:
				if (oNavButtonPressEvent) {
					this.showMessageYesNo({
						text: this.getResourceBundle().getText("FractureCheck.Break"),
						onYesAction: function () {
							this.onBreakFractureCheck();
						}.bind(this),
						onNoAction: function () {}
					});
				} else {
					this.onContinueChecks();
				}
				break;
			default:
			}
		},

		onContinueChecks: function () {
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			var oParams = this.getStartupParameters();
			this.readDocHU(oParams.Tanum).then(
				function (oData) {
					if (oData.results.length === 1) {
						var oDocHU = oData.results[0];
						oRouter.navTo("RouteSumCheck", {
							huId: oDocHU.HuId
						});
					}
				}.bind(this),
				function (oError) {});
		},

		onBreakFractureCheck: function () {

			var oQuant = {
				Client: this.getModel("app").getProperty("/Data/Client"),
				Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
				Wenum: this.getModel("app").getProperty("/Data/Tanum")
			};

			var oError = {
				Tanum: this.getModel("app").getProperty("/Data/Tanum"),
				Text: this.getResourceBundle().getText("FractureCheck.BreakText")
			};

			this.getView().setBusy(true);
			Promise.all([
				this.findQuant(oQuant), // aValues[0]
				this.writeGRErrorLog(oError) // aValues[1]
			]).then(function (aValues) {

				var oWHQuant = aValues[0].results.length > 0 ? aValues[0].results[0] : null;
				if (oWHQuant) {
					oWHQuant.Skzua = "X";
					oWHQuant.Spgru = "7";
				}

				Promise.all([
					this.updateQuant(oWHQuant)
				]).then(function (aUpdValues) {
					this.getView().setBusy(false);
					this.onContinueChecks();
				}.bind(this));

			}.bind(this));
		},

		onInputMacIdButtonPress: function (oPressEvent) {
			var bEnabled = this.getModel("app").getProperty("/State/FractureMasterCartonInputEditable");
			this.getModel("app").setProperty("/State/FractureMasterCartonInputEditable", !bEnabled);

			setTimeout(function () {
				if (!bEnabled) {
					this.getView().byId("idFractureMacIDInput").focus();
				} else {
					this.getView().byId("idFractureSerialIDInput").focus();
				}
			}.bind(this), 5);
		},

		onBookFractureSerialButtonPress: function (oPressEvent) {

			var iPalMenge = parseInt(this.getModel("app").getProperty("/Data/Vemng"), 10);
			var iFrcMenge = this.getFractureMenge();
			if (iPalMenge !== iFrcMenge) {
				this.showMessageDiffPalAndFrcMenge({
					PalMenge: iPalMenge,
					FrcMenge: iFrcMenge,
					onClose: function () {}
				});
			} else {
				this.getView().setBusy(true);
				this.deletePalIdFromSerial(this.getModel("app").getProperty("/Data/pallet")).then(function (odata) {
					this.getView().setBusy(false);
					this.onNavButtonPress();
				}.bind(this));
			}
		},

		getFractureMenge: function () {
			var aFractureSerial = this.getModel("app").getProperty("/Data/FractureSerial");
			return aFractureSerial ? aFractureSerial.length : 0;
		},

		onFracturePalIDInputSubmit: function (oSubmitEvent) {

			var sPalID = oSubmitEvent.getParameter("value");
			var fnProcess = function (sPalID1) {
				this.getView().setBusy(true);
				Promise.all([
					this.readPallet({
						PalId: sPalID1,
						MatNr: this.getModel("app").getProperty("/Data/Matnr")
					}), // aValues[0]
					this.getQMStateForPalett(sPalID1) // aValues[1]
				]).then(function (aValues) {
					this.getView().setBusy(false);

					var oPalletData = aValues[0];
					if (oPalletData.results.length > 0) {

						var oData = aValues[1];
						if (oData.checked) {
							this.showMessagePalletWasChecked({
								palId: sPalID1,
								onClose: function () {
									this.getModel("app").setProperty("/Data/PalID", "");
								}.bind(this)
							});
						} else {
							var oPallet = new Pallet({
								palId: sPalID1,
								serialAddList: oPalletData.results
							});

							this.writeBillingReport({
								RepId: REPID,
								PalId: sPalID1
							});

							this.getModel("app").setProperty("/Data/pallet", oPallet);
							this.getModel("app").setProperty("/State/FractureSerialIDInputEditable", true);
							//this.getModel("app").setProperty("/State/FracturePalIDInputEditable", false);

							this.getView().byId("idFractureSerialIDInput").focus();
						}

					} else {
						this.showMessagePalletNotFound({
							palId: sPalID1,
							matNr: this.getModel("app").getProperty("/Data/Matnr"),
							onClose: function () {
								this.getModel("app").setProperty("/Data/PalID", "");
							}.bind(this)
						});
					}
				}.bind(this));
			}.bind(this);

			this.readBarcode(sPalID).then(
				function (oData) {
					var sSSCC = oData.SSCC ? oData.SSCC : sPalID;
					if (!this.isSSCCvalid(sSSCC)) {
						sap.m.MessageToast.show(this.getResourceBundle().getText("Message.SSCCNotValid", [sSSCC, 18, sSSCC.length]));
					} else {
						fnProcess(sSSCC);
					}
				}.bind(this),
				function () {
					if (!this.isSSCCvalid(sPalID)) {
						sap.m.MessageToast.show(this.getResourceBundle().getText("Message.SSCCNotValid", [sPalID, 18, sPalID.length]));
					} else {
						fnProcess(sPalID);
					}
				}.bind(this));

		},

		onFractureMacIDInputSubmit: function (oSubmitEvent) {
			var sMacId = oSubmitEvent.getParameter("value");
			if (!this.isSSCCvalid(sMacId)) {
				sap.m.MessageToast.show(this.getResourceBundle().getText("Message.SSCCNotValid", [sMacId, 18, sMacId.length]));
				return;
			}

			var fnProcess = function (sMacId1) {
				var oPallet = this.getModel("app").getProperty("/Data/pallet");
				if (oPallet.macList.length > 0) {
					if (oPallet.isMacExist(sMacId1)) {

						var aFractureSerial = this.getModel("app").getProperty("/Data/FractureSerial");
						var aSerialList = oPallet.getSerialListForMac(sMacId1);
						aSerialList.forEach(function (oSerial) {
							var oFoundSerial = aFractureSerial.find(function (oLocSerial) {
								return oLocSerial.Number === oSerial.Sernr;
							});
							if (!oFoundSerial) {
								aFractureSerial.push({
									Number: oSerial.Sernr
								});

								oPallet.setSerialFracture(oSerial.Sernr, true);
							}
						});

						this.writeBillingReport({
							RepId: REPID,
							MacId: sMacId1
						});
					} else {
						this.showMessageMacIDWrong({
							MacID: sMacId1,
							onClose: function () {}
						});
					}
				}
				this.getModel("app").setProperty("/Data/MacID", "");
			}.bind(this);

			this.readBarcode(sMacId).then(
				function (oData) {
					fnProcess(oData.SSCC ? oData.SSCC : sMacId);
				}.bind(this),
				function () {
					fnProcess(sMacId);
				}.bind(this));
		},

		onFractureSerialIDInputSubmit: function (oSubmitEvent) {

			var sSerial = oSubmitEvent.getParameter("value");

			var fnProcess = function (sSerialLocal) {

				var oPallet = this.getModel("app").getProperty("/Data/pallet");
				if (oPallet.isSerialExist(sSerialLocal)) {
					oPallet.setSerialFracture(sSerialLocal, true);

					var aFractureSerial = this.getModel("app").getProperty("/Data/FractureSerial");
					var oFoundSerial = aFractureSerial.find(function (oLocSerial) {
						return oLocSerial.Number === sSerial;
					});

					if (!oFoundSerial) {
						aFractureSerial.push({
							Number: sSerialLocal
						});
					}

					this.writeBillingReport({
						RepId: REPID,
						SerNr: sSerialLocal
					});

				} else {
					this.showMessageSerialNotFound({
						SerNR: sSerialLocal,
						onClose: function () {}.bind(this)
					});
				}
				this.getModel("app").setProperty("/Data/FractureSerialID", "");
			}.bind(this);

			this.readBarcode(sSerial).then(
				function (oData) {
					fnProcess(oData.SerialNumber ? oData.SerialNumber : sSerial);
				}.bind(this),
				function () {
					fnProcess(sSerial);
				}.bind(this));

		},

		onFractureSerialDelete: function (oDeleteEvent) {

			var oItem = oDeleteEvent.getParameter("listItem");
			var oObject = oItem.getBindingContext("app").getObject();

			var aFractureSerial = this.getModel("app").getProperty("/Data/FractureSerial");
			aFractureSerial = aFractureSerial.filter(function (oLocSerial) {
				return oLocSerial.Number !== oObject.Number;
			});

			this.getModel("app").setProperty("/Data/FractureSerial", aFractureSerial);

			var oPallet = this.getModel("app").getProperty("/Data/pallet");
			oPallet.setSerialFracture(oObject.Number, false);
		},

		showMessageDiffPalAndFrcMenge: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.DiffPalAndFrcMenge", [oContext.PalMenge, oContext.FrcMenge]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		},

		showMessageSerialNotFound: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.SerialNotFound", [oContext.SerNR]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.SerialTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		}

	});
});