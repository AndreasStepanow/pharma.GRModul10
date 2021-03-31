sap.ui.define([
	"./BaseController", "sap/ui/core/routing/History",
	"sap/m/MessageBox", "de/arvato/GRModul10/src/Pallet"
], function (BaseController, History, MessageBox, Pallet) {
	"use strict";

	var SUMCHECK_SUCCESSFULL = "3";
	var SUMCHECK_WRONG_LESS = "2";
	var SUMCHECK_WRONG_LARGE = "1";

	var WORKMODE_INDEPENDENT = "Independent";
	var WORKMOD_FUTUREWE = "AutomaticFutureWE";

	var REPID = "SUMC";

	return BaseController.extend("de.arvato.GRModul10.controller.SumCheck", {

		onInit: function () {

			this.initMessageManager();
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
			oRouter.getRoute("RouteSumCheck").attachPatternMatched(this._onObjectMatched, this);
		},

		_onObjectMatched: function (oObjectMatchedEvent) {

			jQuery.sap.log.info("SumCheck._onObjectMatched(): " + this.getWorkMode());

			var sPathToDocHU = "/DocHUSet(guid'" + oObjectMatchedEvent.getParameter("arguments").huId + "')";
			//this.getView().getModel("erp").removeData();
			//sPathToDocHU += "/?$expand=CheckSet,CheckSet/RoughGRSet,DocItem,TransferOrder";

			//var oBindingContext = this.getView().getBindingContext("erp");

			// if (oBindingContext && oBindingContext.getPath() === sPathToDocHU) {
			// 	this.setInitialData(this.getView().getBindingContext("erp").getObject(), true);
			// } else {
			this.getView().bindElement({
				path: sPathToDocHU,
				model: "erp",
				parameters: {
					expand: "DocItem,CheckSet,CheckSet/RoughGRSet,TransferOrder"
				},
				events: {
					change: this._onBindingChange.bind(this),
					dataRequested: function (oDataRequestedEvent) {
						this.getView().setBusy(true);
					}.bind(this),
					dataReceived: this._onDataReceived.bind(this)
				}
			});
			//}
		},

		_onBindingChange: function (oBindingChangeEvent) {
			if (!this.getView().getBindingContext("erp")) {
				this.getRouter().getTargets().display("notFound");
			} else {
				this.setInitialData(oBindingChangeEvent.getSource().getBoundContext().getObject(), true);
				this.getView().byId("idPalIDInput").focus();
			}
		},

		_onDataReceived: function (oDataReceivedEvent) {
			this.getView().setBusy(false);
			// this.setInitialData(oDataReceivedEvent.getParameter("data"), true);
			// this.getView().byId("idPalIDInput").focus();
		},

		onPonumInputSubmit: function (oPonumInputSubmitEvent) {
			this.updatePOInDocItem();
		},

		onPalIDInputSubmit: function (oPalIDInputSubmitEvent) {

			var sPalID = oPalIDInputSubmitEvent.getParameter("value");
			if (!sPalID) {
				oPalIDInputSubmitEvent.getSource().setValueState("Error");
				return;
			} else {
				oPalIDInputSubmitEvent.getSource().setValueState("None");
			}

			var fnProcess = function (sSerial) {

				this.getModel("app").setProperty("/Data/PalID", sSerial);
				if (this.getWorkMode() === WORKMOD_FUTUREWE) {
					this.getQMStateForPalett(sSerial).then(function (oData) {
						if (oData.checked) {
							this.showMessagePalletWasChecked({
								palId: sSerial,
								onClose: function () {
									this.getModel("app").setProperty("/Data/PalID", "");
								}.bind(this)
							});
						} else {
							this.doChecksForPalett({
								PalId: sSerial,
								MatNr: this.getModel("app").getProperty("/Data/Matnr")
							});
						}
					}.bind(this), function () {}.bind(this));
				} else {
					this.doChecksForPalett({
						PalId: sSerial,
						MatNr: this.getModel("app").getProperty("/Data/Matnr")
					});
				}

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

		doChecksForPalett: function (oData) {

			this.readSerialCountForPallet(oData).then(function (sCount) {

				if (sCount > 0) {
					this.processAfterPalletInput({
						id: oData.PalId,
						count: sCount
					});

					this.writeBillingReport({
						RepId: REPID,
						PalId: oData.PalId
					});

					this.sendConfirmation({
						palId: oData.PalId
					}).then(function () {}, function () {
						this.getView().setBusy(false);
					}.bind(this));
				} else {

					this.readSerialCountForMasterCarton({
						MacId: oData.PalId
					}).then(function (sMasterCartonCount) {
						if (sMasterCartonCount > 0) {
							this.showMessageMacIdEntetred();
						} else {
							this.showMessagePalletNotFound({
								palId: oData.PalId,
								matNr: oData.MatNr,
								onClose: function () {

									var oQuant = {
										Client: this.getModel("app").getProperty("/Data/Client"),
										Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
										Wenum: this.getModel("app").getProperty("/Data/Tanum")
									};

									this.getView().setBusy(true);
									Promise.all([
										this.findQuant(oQuant),
										this.writeGRErrorLog({
											PalId: oData.PalId,
											QMChk: "0",
											QMStatus: "0",
											Tanum: this.getModel("app").getProperty("/Data/Tanum")
										})
									]).then(function (aValues) {
										this.getView().setBusy(false);
										var oWHQuant = aValues[0].results.length > 0 ? aValues[0].results[0] : null;
										oWHQuant.Skzua = "X";
										oWHQuant.Spgru = "7";
										if (oWHQuant) {
											this.updateQuant(oWHQuant).then(function () {
												this.clearViewContext();
												this.onNavButtonPress();
											}.bind(this));
										}

									}.bind(this));

								}.bind(this)
							});
						}
					}.bind(this));

					this.getModel("app").setProperty("/Data/PalID", "");
				}
			}.bind(this), function (oError) {
				this.getModel("app").setProperty("/State/PalletScanSuccess", false);
			}.bind(this));
		},

		processAfterPalletInput: function (oPalletData) {

			this.getModel("app").setProperty("/Data/ReceivedAmount", oPalletData.count);
			this.getModel("app").setProperty("/State/SumCheckSuccess", true);

			var sQmChk = this.getPalletQMChk();

			var oPallet = new Pallet({
				palId: oPalletData.id,
				serialAddList: oPalletData.results,
				qmChk: sQmChk,
				Customizing: this.getModel("app").getProperty("/Customizing")
			});

			if (sQmChk !== SUMCHECK_SUCCESSFULL) {
				oPallet.lockQuant = true;
			} else {
				oPallet.lockQuant = false;
			}

			var fnUpdate = function () {

				this.getModel("app").setProperty("/Data/pallet", oPallet);
				this.getView().setBusy(true);

				var oQuant = {
					Client: this.getModel("app").getProperty("/Data/Client"),
					Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
					Wenum: this.getModel("app").getProperty("/Data/Tanum")
				};

				Promise.all([
					this.updateSerialProtocolToDocument(oPallet),
					this.updateAssignmentIndicatorForPallet(oPallet),
					this.findQuant(oQuant)
				]).then(function (aValues) {
					if (oPallet.lockQuant === true) {
						var oWHQuant = aValues[2].results.length > 0 ? aValues[2].results[0] : null;
						if (oWHQuant) {
							oWHQuant.Skzua = "X";
							oWHQuant.Spgru = "7";
							this.updateQuant(oWHQuant).then(function () {});
						}
					}
				}.bind(this));

				this.updateSerialQMChkForPallet(oPallet).then(
					function (oData1) {
						this.getView().setBusy(false);
						this.showMessagePalIDSuccess({
							qmChk: sQmChk,
							onClose: function () {
								var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
								if (sQmChk === SUMCHECK_SUCCESSFULL) {
									this.getModel("app").setProperty("/State/PalletScanSuccess", true);
									oRouter.navTo("RouteSampleCheck", {
										huId: this.getModel("app").getProperty("/Data/DocHuId")
									});
								} else {
									this.clearViewContext();
									this.onNavButtonPress();
								}
							}.bind(this)
						});

						var sMessage1 = this.getResourceBundle().getText("Message.PalletUpdateSuccess", [oPallet.palId]);
						sap.ui.getCore().getMessageManager().addMessages(this.getMessage("Information", sMessage1));
					}.bind(this),
					function (oError) {
						sap.ui.getCore().getMessageManager().addMessages(this.getMessage("Error", this.getMessageErrorValue(oError)));
					}.bind(this));

			}.bind(this);

			if (!oPallet.isChecked()) {
				fnUpdate();
			} else {
				this.showMessagePalIDAlreadyChecked({
					palId: oPalletData.id,
					onClose: function (oAction) {
						if (oAction === MessageBox.Action.NO) {
							this.clearViewContext();
							this.onNavButtonPress();
						} else {
							fnUpdate();
						}
					}.bind(this)
				});
			}
		},

		onRecheckButtonPress: function (oEvent) {
			this.getModel("app").setProperty("/State/RecheckActiv", oEvent.getParameter("pressed"));
		},

		showMessagePalIDAlreadyChecked: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.PalletAlreadyChecked", [oContext.palId]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.PalletTitle"),
					actions: [MessageBox.Action.YES, MessageBox.Action.NO],
					onClose: function (oAction) {
						oContext.onClose(oAction);
					}
				}
			);
		},

		getPalletQMChk: function () {

			var iReceivedAmount = parseInt(this.getModel("app").getProperty("/Data/ReceivedAmount"), 10);
			var iCapturedAmountInput = parseInt(this.getView().byId("idCapturedAmountInput").getValue(), 10);

			if (iReceivedAmount === iCapturedAmountInput) {
				return SUMCHECK_SUCCESSFULL;
			} else if (iReceivedAmount > iCapturedAmountInput) {
				return SUMCHECK_WRONG_LESS;
			} else {
				return SUMCHECK_WRONG_LARGE;
			}
		},

		showMessagePalIDSuccess: function (oContext) {

			var sOk = this.getResourceBundle().getText("Message.OK");
			var sNotOk = this.getResourceBundle().getText("Message.NotOK");
			var sMessage = this.getResourceBundle().getText("SumCheck.Check", [oContext.qmChk === SUMCHECK_SUCCESSFULL ? sOk : sNotOk]);

			MessageBox.show(
				sMessage, {
					icon: MessageBox.Icon.INFORMATION,
					title: this.getResourceBundle().getText("SumCheck.MessageTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}.bind(this)
				}
			);
		},

		onNavButtonPress: function (oNavButtonPressEvent) {

			var sWorkMode = this.getWorkMode();
			jQuery.sap.log.info("SumCheck.onNavButtonPress(): " + sWorkMode);

			switch (sWorkMode) {
			case WORKMODE_INDEPENDENT:
				this.clearViewContext();
				var oHistory = History.getInstance();
				var sPreviousHash = oHistory.getPreviousHash();

				if (sPreviousHash !== undefined) {
					window.history.go(-1);
				} else {
					var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
					oRouter.navTo("RouteMain", true);
				}
				break;
			case WORKMOD_FUTUREWE:

				if (oNavButtonPressEvent) {
					this.showMessageYesNo({
						text: this.getResourceBundle().getText("SumCheck.Break"),
						onYesAction: function () {
							this.onBreakSumCheck();
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
		},

		onBreakSumCheck: function () {

			var oQuant = {
				Client: this.getModel("app").getProperty("/Data/Client"),
				Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
				Wenum: this.getModel("app").getProperty("/Data/Tanum")
			};

			var oError = {
				Tanum: this.getModel("app").getProperty("/Data/Tanum"),
				Text: this.getResourceBundle().getText("SumCheck.BreakText")
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
		}

	});
});