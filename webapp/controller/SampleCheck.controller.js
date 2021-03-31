sap.ui.define([
	"./BaseController", "sap/ui/core/routing/History",
	"sap/m/MessageBox", "de/arvato/GRModul10/src/Pallet"
], function (BaseController, History, MessageBox, Pallet) {
	"use strict";

	var SAMPLECHECK_SUCCESSFULL = "2";
	var SAMPLECHECK_NOT_USE = "3";
	var SAMPLECHECK_WRONG = "1";

	var WORKMODE_INDEPENDENT = "Independent";
	var WORKMOD_FUTUREWE = "AutomaticFutureWE";

	var REPID = "SAMPLEC";

	return BaseController.extend("de.arvato.GRModul10.controller.SampleCheck", {

		onInit: function () {

			this.initMessageManager();
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			oRouter.getRoute("RouteSampleCheck").attachPatternMatched(this._onObjectMatched, this);
		},

		_onObjectMatched: function (oObjectMatchedEvent) {

			this.getView().bindElement({
				path: "/DocHUSet(guid'" + oObjectMatchedEvent.getParameter("arguments").huId + "')",
				model: "erp",
				parameters: {
					expand: "DocItem"
				},
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function (oDataRequestedEvent) {
						this.getView().setBusy(true);
					}.bind(this),
					dataReceived: this._onDataReceived.bind(this)
				}
			});
		},

		_onDataReceived: function (oDataReceivedEvent) {
			this.getView().setBusy(false);
			this.getView().byId("idMacIDInput").focus();
		},

		_onBindingChange: function (oBindingChangeEvent) {

			// No data for the binding
			if (!this.getView().getBindingContext("erp")) {
				this.getRouter().getTargets().display("notFound");
			}

			var oPallet = this.getModel("app").getProperty("/Data/pallet");
			this.getView().setBusy(true);

			this.readPallet({
				PalId: oPallet.palId,
				MatNr: this.getModel("app").getProperty("/Data/Matnr")
			}).then(function (oData) {
				this.getView().setBusy(false);

				if (oData.results.length === 0) {
					this.showMessagePalletNotFound({
						palId: oPallet.palId,
						matNr: this.getModel("app").getProperty("/Data/Matnr"),
						onClose: function () {

						}
					});
				} else {

					oPallet.createContext(oData.results);
					oPallet.createCheckContext();

					if (oPallet.getMacCount() > 0) {
						this.getModel("app").setProperty("/State/MasterCartonInputEditable", true);
						this.getView().byId("idMacIDInput").focus();
					} else {
						this.getModel("app").setProperty("/State/SerialIDInputEditable", true);
						this.getView().byId("idSerialIDInput").focus();
					}
				}

			}.bind(this));
		},

		onNavButtonPress: function (oNavButtonPressEvent) {

			this.clearViewContext();

			var oHistory = History.getInstance();
			var sPreviousHash = oHistory.getPreviousHash();

			if (sPreviousHash !== undefined) {
				window.history.go(-1);
			} else {
				var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
				oRouter.navTo("RouteSumCheck", true);
			}
		},

		onMacIDInputSubmit: function (oMacIDInputSubmitEvent) {

			var sMacID = oMacIDInputSubmitEvent.getParameter("value");
			if (!sMacID) {
				oMacIDInputSubmitEvent.getSource().setValueState("Error");
				return;
			} else {
				oMacIDInputSubmitEvent.getSource().setValueState("None");
			}

			this.readBarcode(sMacID).then(
				function (oData) {
					var sSSCC = oData.SSCC ? oData.SSCC : sMacID;
					if (!this.isSSCCvalid(sSSCC)) {
						sap.m.MessageToast.show(this.getResourceBundle().getText("Message.SSCCNotValid", [sSSCC, 18, sSSCC.length]));
					} else {
					this.processAfterMacIDInput({
						Value: sSSCC
					});
					}
				}.bind(this),
				function () {
					if (!this.isSSCCvalid(sMacID)) {
						sap.m.MessageToast.show(this.getResourceBundle().getText("Message.SSCCNotValid", [sMacID, 18, sMacID.length]));
					} else {
						this.processAfterMacIDInput({
							Value: sMacID
						});
					}
				}.bind(this));

		},

		onSerialIDInputSubmit: function (oSerialIDInputSubmitEvent) {

			var sSerialID = oSerialIDInputSubmitEvent.getParameter("value");
			if (!sSerialID) {
				oSerialIDInputSubmitEvent.getSource().setValueState("Error");
				return;
			} else {
				oSerialIDInputSubmitEvent.getSource().setValueState("None");
			}

			this.readBarcode(sSerialID).then(
				function (oData) {
					this.processAfterSerialInput({
						Value: oData.SerialNumber ? oData.SerialNumber : sSerialID
					});
				}.bind(this),
				function () {
					this.processAfterSerialInput({
						Value: sSerialID
					});
				});
		},

		processUpdate: function () {

			var fnUpdate = function () {

				var oPallet = this.getModel("app").getProperty("/Data/pallet");
				oPallet.Lgtyp = this.getModel("app").getProperty("/Data/Lgtyp");
				oPallet.Lgpla = this.getModel("app").getProperty("/Data/Lgpla");

				oPallet.Lgtyp = oPallet.Lgtyp ? oPallet.Lgtyp.toUpperCase() : "";
				oPallet.Lgpla = oPallet.Lgpla ? oPallet.Lgpla.toUpperCase() : "";

				var oQuant = {
					Client: this.getModel("app").getProperty("/Data/Client"),
					Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
					Wenum: this.getModel("app").getProperty("/Data/Tanum")
				};

				this.getView().setBusy(true);
				Promise.all([
					this.updateSerialQMStatusForPallet(oPallet),
					this.updateAssignmentIndicatorForPallet(oPallet),
					this.findQuant(oQuant)
				]).then(function (aValues) {
					var oWHQuant = aValues[2].results.length > 0 ? aValues[2].results[0] : null;
					if (oPallet.lockQuant === true) {
						oWHQuant.Skzua = "X";
						oWHQuant.Spgru = "7";
					} else {
						oWHQuant.Skzua = "";
						oWHQuant.Spgru = "";
					}

					if (oWHQuant) {
						this.updateQuant(oWHQuant).then(function () {
							this.getView().setBusy(false);
							this.clearViewContext();
							this.navToMain();
						}.bind(this));
					}

				}.bind(this));
			}.bind(this);

			if (this.getModel("app").getProperty("/State/RecheckActiv")) {
				this.get2FieldInputDialog({
					title: this.getResourceBundle().getText("SampleCheck.StoregBinDialogTitle"),
					bindPath1: "{app>/Data/Lgtyp}",
					label1Text: this.getResourceBundle().getText("SampleCheck.StorageType"),
					bindPath2: "{app>/Data/Lgpla}",
					label2Text: this.getResourceBundle().getText("SampleCheck.StorageBin"),
					onPress: function (oData) {
						fnUpdate();
					}.bind(this)
				}).open();
			} else {
				fnUpdate();
			}
		},

		navToMain: function () {

			var sWorkMode = this.getWorkMode();
			jQuery.sap.log.info("SampleCheck.navToMain(): " + sWorkMode);

			switch (sWorkMode) {
			case WORKMODE_INDEPENDENT:
				var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
				oRouter.navTo("RouteMain", true);
				break;
			case WORKMOD_FUTUREWE:
				var oParams = this.getStartupParameters();
				this.goToSemanticObject({
					SemanticObject: this.getModel("app").getProperty("/PalletizingSemanticObjekt"),
					Action: this.getModel("app").getProperty("/PalletizingAction"),
					Parameters: {
						"EmployeeID": oParams.EmployeeID,
						"Printer": oParams.Printer,
						"ItemId": oParams.ItemId
					}
				});
				break;
			default:
			}
		},

		processAfterMacIDInput: function (oMac) {

			this.getModel("app").setProperty("/Data/MacID", oMac.Value);
			var oPallet = this.getModel("app").getProperty("/Data/pallet");
			oPallet.lockQuant = false;

			if (oPallet.macList.length > 0) {

				if (oPallet.isMacExist(oMac.Value)) {

					oPallet.setMacChecked({
						Value: oMac.Value
					});

					this.writeBillingReport({
						RepId: REPID,
						MacId: oMac.Value
					});

					this.getModel("app").setProperty("/State/MasterCartonScanSuccess", true);
					this.getModel("app").setProperty("/State/MasterCartonInputEditable", false);
					this.getModel("app").setProperty("/State/SerialIDInputEditable", true);
					this.getView().byId("idSerialIDInput").focus();
				} else {

					this.showMessageMacIDWrong({
						MacID: oMac.Value,
						onClose: function () {
							oPallet.setQMStateForAllSerial(SAMPLECHECK_WRONG);
							this.getModel("app").setProperty("/Data/MacID", "");
							oPallet.lockQuant = true;
							this.processUpdate();
						}.bind(this)
					});

				}
			}
		},

		processAfterSerialInput: function (oSerial) {

			var sMac = this.getModel("app").getProperty("/Data/MacID");
			var oPallet = this.getModel("app").getProperty("/Data/pallet");
			oPallet.lockQuant = false;
			oSerial.Parent = sMac;

			if (oPallet.isSerialVerified(oSerial.Value)) {

				this.showMessageForVerifiedSerial({
					Serial: oSerial.Value,
					onClose: function () {
						this.getModel("app").setProperty("/Data/SerialID", "");
					}.bind(this)
				});

			} else if (oPallet.isSerialExist(oSerial.Value)) {

				this.writeBillingReport({
					RepId: REPID,
					SerNr: oSerial.Value
				});

				if (oPallet.macList.length > 0 && !oPallet.isSerialInMac(oSerial.Value, sMac)) {

					oPallet.setQMStateForSerial(oSerial.Value, SAMPLECHECK_WRONG);
					oPallet.setQMStateForAllSerial(SAMPLECHECK_WRONG);

					oPallet.resetChecked();
					oPallet.lockQuant = true;

					this.showMessageSerialNotInMac({
						SerNR: oSerial.Value,
						MacID: sMac,
						onClose: this.processUpdate
					});

				} else {

					oPallet.setQMStateForSerial(oSerial.Value, SAMPLECHECK_SUCCESSFULL);
					oPallet.setQMStateForAllSerial(SAMPLECHECK_NOT_USE);
					oPallet.setSerialChecked(oSerial);
					this.getModel("app").setProperty("/Data/SerialID", "");

					if (oPallet.isOpenSerCheckAvailable(sMac)) {

						this.getModel("app").setProperty("/State/SerialNumberScanSuccess", true);

					} else if (oPallet.isOpenMacCheckAvailable()) {

						this.getModel("app").setProperty("/State/SerialIDInputEditable", false);
						this.getModel("app").setProperty("/State/MasterCartonInputEditable", true);
						this.getModel("app").setProperty("/Data/MacID", "");
						this.getView().byId("idMacIDInput").focus();

					} else {

						this.showMessageSampleCheckSuccess({
							onClose: function () {
								oPallet.lockQuant = false;
								this.processUpdate();
							}.bind(this)
						});
					}
				}

			} else {

				this.showMessageSerialNotFound({
					SerNR: oSerial.Value,
					onClose: function () {
						oPallet.setQMStateForAllSerial(SAMPLECHECK_WRONG);
						oPallet.lockQuant = true;
						this.processUpdate();
					}.bind(this)
				});

			}
		},

		showMessageForVerifiedSerial: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("SampleCheck.SerialVerifid", [oContext.Serial]), {
					icon: MessageBox.Icon.INFORMATION,
					title: this.getResourceBundle().getText("SampleCheck.MessageTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		},

		showMessageSampleCheckSuccess: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("SampleCheck.Check", [this.getResourceBundle().getText("Message.OK")]), {
					icon: MessageBox.Icon.INFORMATION,
					title: this.getResourceBundle().getText("SampleCheck.MessageTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		},

		showMessageSerialNotInMac: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.SerialNotInMac", [oContext.SerNR, oContext.MacID]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.SerialNotInMac"),
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