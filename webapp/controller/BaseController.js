sap.ui.define([
	"sap/ui/core/mvc/Controller", "sap/ui/core/routing/History", "sap/ui/core/message/Message",
	"de/arvato/GRModul10/model/Formatter", "sap/ui/model/Filter",
	"sap/ui/model/FilterOperator", "sap/m/MessageBox"
], function (Controller, History, Message, Formatter, Filter, FilterOperator, MessageBox) {
	"use strict";

	var SUMCHECK_SUCCESSFULL = "3";
	//var SUMCHECK_WRONG_LESS = "2";
	//var SUMCHECK_WRONG_LARGE = "1";

	//var SAMPLECHECK_SUCCESSFULL = "2";
	var SAMPLECHECK_NOT_USE = "3";
	var SAMPLECHECK_WRONG = "1";

	var WORKMODE_INDEPENDENT = "Independent";
	var WORKMOD_FUTUREWE = "AutomaticFutureWE";

	return Controller.extend("de.arvato.GRModul10.controller.BaseController", {

		formatter: Formatter,
		
		isSSCCvalid: function (sSSCC) {
			if(sSSCC && sSSCC.length === 18){
				return true;
			} else {
				return false;
			}
		},

		attachRouteMatched: function (oEvent) {
			this.getModel("app").setProperty("/CurrentRoute", oEvent.getParameter("name"));
		},

		setInitialData: function (oDocHU, bReadMaterial) {

			if (oDocHU === undefined) {
				return;
			}

			// Irgendwie will expand in bindElement() in GPY in der sapui5-Version 1.38 nicht laufen!
			if (oDocHU.CheckSet.__ref) {
				var oCheck = this.getModel("erp").getData("/" + oDocHU.CheckSet.__ref);
				var oRoughGR = this.getModel("erp").getData("/RoughGRSet('" + oCheck.Zgweno + "')");
				var oDocItem = this.getModel("erp").getData("/" + oDocHU.DocItem.__ref);
			}

			this.getModel("app").setProperty("/Data/DocHuId", oDocHU.HuId);
			this.getModel("app").setProperty("/Data/Tanum", oDocHU.Tanum);
			this.getModel("app").setProperty("/Data/Vemng", oDocHU.Vemng); // Menge erfasste bei der Palettierung
			this.getModel("app").setProperty("/Data/Client", oDocHU.CheckSet.Client ? oDocHU.CheckSet.Client : oCheck.Client);
			this.getModel("app").setProperty("/Data/Lgnum", oDocHU.CheckSet.Lgnum ? oDocHU.CheckSet.Lgnum : oCheck.Lgnum);
			this.getModel("app").setProperty("/Data/Zgweno", oDocHU.CheckSet.RoughGRSet ? oDocHU.CheckSet.RoughGRSet.Zgweno : oRoughGR.Zgweno);
			this.getModel("app").setProperty("/Data/Zbetrst", oDocHU.CheckSet.RoughGRSet ? oDocHU.CheckSet.RoughGRSet.Zbetrst : oRoughGR.Zbetrst);
			this.getModel("app").setProperty("/Data/DocItemId", oDocHU.DocItem.ItemId ? oDocHU.DocItem.ItemId : oDocItem.ItemId);
			this.getModel("app").setProperty("/Data/Matnr", oDocHU.DocItem.Matnr ? oDocHU.DocItem.Matnr : oDocItem.Matnr);

			this.getModel("erp").setHeaders({
				"mandt": this.getModel("app").getProperty("/Data/Client"),
				"zbetrst": this.getModel("app").getProperty("/Data/Zbetrst")
			});

			if (bReadMaterial) {
				this.readMaterial({
					Client: this.getModel("app").getProperty("/Data/Client"),
					Zbetrst: this.getModel("app").getProperty("/Data/Zbetrst"),
					Matnr: this.getModel("app").getProperty("/Data/Matnr"),
					Werks: ""
				}).then(this._onReadMaterialSuccessful.bind(this));
			}
		},

		setStartupParameters: function (oStartupParams) {
			//jQuery.sap.log.info("Main.setStartupParameters(): " + Object.values(oStartupParams));
			this.getModel("app").setProperty("/StartupParams", oStartupParams);
		},

		getStartupParameters: function () {
			//var oStartupParams = this.getModel("app").getProperty("/StartupParams");
			//jQuery.sap.log.info("Main.setStartupParameters(): " + Object.values(oStartupParams));
			return this.convertStartupParameters(this.getOwnerComponent().getComponentData().startupParameters);
		},

		convertStartupParameters: function (startupParams) {
			return {
				EmployeeID: startupParams.EmployeeID ? startupParams.EmployeeID[0] : "",
				EmployeeName: startupParams.EmployeeName ? decodeURIComponent(startupParams.EmployeeName[0]) : "",
				Printer: startupParams.Printer ? startupParams.Printer[0] : "",
				ItemId: startupParams.ItemId ? startupParams.ItemId[0] : "",
				Tanum: startupParams.Tanum ? startupParams.Tanum[0] : "",
				TanumBruch: startupParams.TanumBruch ? startupParams.TanumBruch[0] : ""
			};
		},

		_onReadMaterialSuccessful: function (oData) {

			if (oData.FullRelevant) {

				// if (!this.getModel("app").getProperty("/State/PONumberCaptured")) {
				// 	this.getInputDialog({
				// 		title: this.getResourceBundle().getText("SumCheck.POInputTitle"),
				// 		bindPath: "{app>/Data/Ponum}",
				// 		onSubmit: function (sValue) {

				// 			this.updatePOInDocItem();
				// 			// var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
				// 			// oRouter.navTo("RouteSumCheck", {
				// 			// 	huId: this.getModel("app").getProperty("/Data/DocHuId")
				// 			// });
				// 		}.bind(this)
				// 	}).open();
				// }

				this.readCustomizingQMCheck({
					Client: this.getModel("app").getProperty("/Data/Client"),
					Sernp: oData.Sernp,
					Lifnr: "",
					Matnr: oData.Matnr
				}).then(function (oData1) {
					this.getModel("app").setProperty("/Customizing", oData1);
				}.bind(this));

			} else {
				this.showMessagePalletNotFullRelefance({
					Matnr: oData.Matnr,
					Sernp: oData.Sernp,
					onClose: function () {
						var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
						oRouter.navTo("RouteMain", true);
						// oRouter.navTo("RouteSumCheck", {
						// 	huId: this.getModel("app").getProperty("/Data/DocHuId")
						// });
					}.bind(this)
				});

			}
		},

		readCustomizingQMCheck: function (oContext) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": oContext.Client
				// });

				var sReadUrl = this.getModel("erp").createKey("/CustomizingQMCheckSet", {
					Sernp: oContext.Sernp,
					Lifnr: oContext.Lifnr,
					Matnr: oContext.Matnr
				});

				this.getModel("erp").read(sReadUrl, {
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},

		readBarcode: function (sCode) {

			return new Promise(function (resolve, reject) {

				var sReadUrl = this.getModel("erp").createKey("/BarcodeSet", {
					Code: sCode
				});

				// this.getModel("erp").setHeaders({
				// 	mandt: this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").read(sReadUrl, {
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject();
					}
				});

			}.bind(this));
		},

		readMaterial: function (oMaterial) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": oMaterial.Client,
				// 	"zbetrst": oMaterial.Zbetrst
				// });

				var sReadUrl = this.getModel("erp").createKey("/MaterialSet", {
					Matnr: oMaterial.Matnr,
					Werks: oMaterial.Werks
				});

				this.getModel("erp").read(sReadUrl, {
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},

		readDocHU: function (sTanum) {

			return new Promise(function (resolve, reject) {

				this.getModel("erp").read("/DocHUSet", {
					/*urlParameters: {
						"$expand": ["CheckSet", "CheckSet/RoughGRSet", "DocItem"]
					},*/
					urlParameters: {
						"$expand": ["TransferOrder"]
					},
					filters: [new sap.ui.model.Filter("Tanum", "EQ", sTanum)],
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},

		readSerialCountForPallet: function (oData) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").read("/SerialAddSet/$count", {
					filters: [
						new sap.ui.model.Filter("Type", "EQ", "PALID"),
						new sap.ui.model.Filter("Value", "EQ", oData.PalId),
						new sap.ui.model.Filter("Matnr", "EQ", oData.MatNr)
					],
					success: function (sCount) {
						resolve(sCount);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

			}.bind(this));
		},

		readSerialCountForMasterCarton: function (oData) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").read("/SerialAddSet/$count", {
					filters: [
						new sap.ui.model.Filter("Type", "EQ", "MACID"),
						new sap.ui.model.Filter("Value", "EQ", oData.MacId)
					],
					success: function (sCount) {
						resolve(sCount);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

			}.bind(this));
		},

		getQMStateForPalett: function (sPalId) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").callFunction("/GetPalettInfo", {
					method: "GET",
					urlParameters: {
						PalID: sPalId
					},
					success: function (oData, response) {
						resolve({
							PalId: oData.GetPalettInfo.PalID,
							checked: oData.GetPalettInfo.QMChkDone
						});
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

			}.bind(this));
		},

		getRefNoForPalett: function (sPalId) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").callFunction("/GetPalettInfo", {
					method: "GET",
					urlParameters: {
						PalID: sPalId
					},
					success: function (oData, response) {
						resolve({
							PalId: oData.GetPalettInfo.PalID,
							RefNo: oData.GetPalettInfo.RefNO
						});
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

			}.bind(this));
		},

		readPallet: function (oData) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").read("/SerialAddSet", {
					urlParameters: {
						"$expand": ["SerialMaster", "SerialMaster/SerialAddSet"]
					},
					filters: [
						new sap.ui.model.Filter("Type", "EQ", "PALID"),
						new sap.ui.model.Filter("Value", "EQ", oData.PalId),
						new sap.ui.model.Filter("Matnr", "EQ", oData.MatNr)
					],
					success: function (oData1) {
						resolve(oData1);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

			}.bind(this));
		},

		updateDocItem: function (oDocItem) {

			return new Promise(function (resolve, reject) {

				var oPath = this.getModel("erp").createKey("/DocItemSet", {
					ItemId: oDocItem.ItemId
				});

				this.getModel("erp").update(oPath, oDocItem, {
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

			}.bind(this));
		},

		findQuant: function (oQuantData) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	"mandt": oQuantData.Client,
				// 	"zbetrst": oQuantData.Zbetrst
				// });

				this.getModel("erp").read("/WHQuantSet", {
					filters: [new Filter("Wenum", FilterOperator.EQ, oQuantData.Wenum)],
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},

		updateQuant: function (oQuant) {

			return new Promise(function (resolve, reject) {
				var oPath = this.getModel("erp").createKey("/WHQuantSet", {
					Lgnum: oQuant.Lgnum,
					Lqnum: oQuant.Lqnum
				});

				this.getModel("erp").update(oPath, oQuant, {
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},
		
		handleAbort: function (oContext) {

			return new Promise(function (resolve, reject) {
				this.getModel("erp").callFunction("/HandleModul10Abort", {
					method: "POST",
					urlParameters: {
						Tanum: oContext.Tanum,
						Text: oContext.Text ? oContext.Text : ""
					},
					success: function (oData, response) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},

		writeGRErrorLog: function (oContext) {

			return new Promise(function (resolve, reject) {
				this.getModel("erp").callFunction("/WriteGRErrorLog", {
					method: "POST",
					urlParameters: {
						PalId: oContext.PalId ? oContext.PalId : "unknown",
						QMChk: oContext.QMChk ? oContext.QMChk : "0",
						QMStatus: oContext.QMStatus ? oContext.QMStatus : "0",
						Tanum: oContext.Tanum,
						Text: oContext.Text ? oContext.Text : ""
					},
					success: function (oData, response) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},

		writeBillingReport: function (oContext) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	mandt: this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").callFunction("/WriteBillingReport", {
					method: "POST",
					urlParameters: {
						RepID: oContext.RepId,
						PalID: oContext.PalId ? oContext.PalId : " ",
						MacID: oContext.MacId ? oContext.MacId : " ",
						SerNR: oContext.SerNr ? oContext.SerNr : "",
						// Werk und Material sind immerhalb der Verarbeitung konstant!
						Werks: this.getModel("app").getProperty("/Data/Werks"),
						Matnr: this.getModel("app").getProperty("/Data/Matnr")
					},
					success: function (oData, response) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});
			}.bind(this));
		},

		updateSerialQMChkForPallet: function (oPallet) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	mandt: this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").callFunction("/SetQMChkSuccessfull", {
					method: "POST",
					urlParameters: {
						PalId: oPallet.palId,
						State: oPallet.qmChk,
						Refno: this.getModel("app").getProperty("/Data/Ponum")
					},
					success: function (oData, response) {

						if (oPallet.qmChk !== SUMCHECK_SUCCESSFULL) {

							var oResourceBundle = this.getResourceBundle();
							this.writeGRErrorLog({
								PalId: oPallet.palId,
								QMChk: oPallet.qmChk,
								QMStatus: oPallet.qmStatus,
								Tanum: this.getModel("app").getProperty("/Data/Tanum"),
								Text: oResourceBundle.getText("SumCheck.Check", [oResourceBundle.getText("Message.NotOK")])
							});
						}

						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

				// var sGroup = "updateSerialQMChkForPallet";
				// this.getModel("erp").setDeferredGroups([sGroup]);

				// var mParameter = {
				// 	groupId: sGroup,
				// 	success: function (oData) {
				// 		resolve(oData);
				// 	},
				// 	error: function (oError) {
				// 		reject(oError);
				// 	}
				// };

				// oPallet.getSerialList().forEach(function (oSerial) {

				// 	this.getModel("erp").create("/SerialAddSet", {
				// 		Guid: oSerial.Guid,
				// 		Type: "QMCHK",
				// 		Value: oPallet.getQMChk(),
				// 		Matnr: oSerial.Matnr,
				// 		Sernr: oSerial.Sernr
				// 	}, {
				// 		groupId: sGroup
				// 	});

				// }.bind(this));

				// this.getModel("erp").submitChanges(mParameter);

			}.bind(this));
		},

		updateSerialQMStatusForPallet: function (oPallet) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	mandt: this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").callFunction("/SetQMStatusSuccessfull", {
					method: "POST",
					urlParameters: {
						PalId: oPallet.palId,
						State: oPallet.qmStatus
					},
					success: function (oData, response) {

						if (oPallet.qmStatus === SAMPLECHECK_WRONG) {

							var oResourceBundle = this.getResourceBundle();
							this.writeGRErrorLog({
								PalId: oPallet.palId,
								QMChk: oPallet.qmChk,
								QMStatus: oPallet.qmStatus,
								Tanum: this.getModel("app").getProperty("/Data/Tanum"),
								Text: oResourceBundle.getText("SumCheck.Check", [oResourceBundle.getText("Message.NotOK")])
							});
						}

						if (oPallet.qmStatus === SAMPLECHECK_NOT_USE) {

							var sGroup = "updateSerialQMStateForPallet";
							this.getModel("erp").setDeferredGroups([sGroup]);

							oPallet.getSerialList().forEach(function (oSerial) {

								if (oSerial.QMStatus !== SAMPLECHECK_NOT_USE) {

									this.getModel("erp").create("/SerialAddSet", {
										Guid: oSerial.Guid,
										Type: "QMSTATUS",
										Value: oSerial.QMStatus,
										Matnr: oSerial.Matnr,
										Sernr: oSerial.Sernr
									}, {
										groupId: sGroup
									});
								}

							}.bind(this));

							this.getModel("erp").submitChanges({
								groupId: sGroup,
								success: function (oData1) {
									resolve(oData);
								},
								error: function (oError) {
									reject(oError);
								}
							});
						} else {
							resolve(oData);
						}
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}
				});

				// oPallet.getSerialList().forEach(function (oSerial) {

				// 	this.getModel("erp").create("/SerialMasterSet", {
				// 		Guid: oSerial.Guid,
				// 		Matnr: oSerial.Matnr,
				// 		Sernr: oSerial.Sernr,
				// 		Lgtyp: oPallet.Lgtyp ? oPallet.Lgtyp : "",
				// 		Lgpla: oPallet.Lgpla ? oPallet.Lgpla : "",
				// 		Vergkz: "5",
				// 		Tanum: this.getModel("app").getProperty("/Data/Tanum")
				// 	}, {
				// 		groupId: sGroup
				// 	});

				// 	this.getModel("erp").create("/SerialAddSet", {
				// 		Guid: oSerial.Guid,
				// 		Type: "QMSTATUS",
				// 		Value: oSerial.QMStatus,
				// 		Matnr: oSerial.Matnr,
				// 		Sernr: oSerial.Sernr
				// 	}, {
				// 		groupId: sGroup
				// 	});

				// }.bind(this));

				// this.getModel("erp").submitChanges({
				// 	groupId: sGroup,
				// 	success: function (oData) {
				// 		resolve(oData);
				// 	},
				// 	error: function (oError) {
				// 		reject(oError);
				// 	}
				// });

			}.bind(this));
		},

		updateAssignmentIndicatorForPallet: function (oPallet) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	mandt: this.getModel("app").getProperty("/Data/Client"),
				// 	zbetrst: this.getModel("app").getProperty("/Data/Zbetrst")
				// });

				this.getModel("erp").callFunction("/SetAssignmentIndicator", {
					method: "POST",
					urlParameters: {
						PalId: oPallet.palId,
						Indicator: oPallet.AssignmentIndicator,
						Tanum: this.getModel("app").getProperty("/Data/Tanum"),
						Lgtyp: oPallet.Lgtyp ? oPallet.Lgtyp : "",
						Lgpla: oPallet.Lgpla ? oPallet.Lgpla : ""
					},
					success: function (oData, response) {
						resolve(oData);
					},
					error: function (oError) {
						reject(oError);
					}
				});

			}.bind(this));
		},

		updateSerialProtocolToDocument: function (oPallet) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	mandt: this.getModel("app").getProperty("/Data/Client"),
				// 	zbetrst: this.getModel("app").getProperty("/Data/Zbetrst")
				// });

				this.getModel("erp").callFunction("/WriteSerialProtocolToDocument", {
					method: "POST",
					urlParameters: {
						PalId: oPallet.palId,
						DocumentType: "g",
						Document: this.getModel("app").getProperty("/Data/Zgweno"),
						Tanum: this.getModel("app").getProperty("/Data/Tanum")
					},
					success: function (oData, response) {
						resolve(oData);
					},
					error: function (oError) {
						reject(oError);
					}
				});

			}.bind(this));
		},

		updatePOInDocItem: function () {

			var oDocItem = {
				ItemId: this.getModel("app").getProperty("/Data/DocItemId"),
				PoNumber: this.getModel("app").getProperty("/Data/Ponum")
			};

			this.updateDocItem(oDocItem).then(
				function (oData) {
					this.getModel("app").setProperty("/State/PONumberCaptured", true);
					var sMessage = this.getResourceBundle().getText("Message.POUpdateSuccess", [oDocItem.PoNumber]);
					sap.ui.getCore().getMessageManager().addMessages(this.getMessage("Information", sMessage));
				}.bind(this),
				function (oError) {
					sap.ui.getCore().getMessageManager().addMessages(this.getMessage("Error", this.getMessageErrorValue(oError)));
				}.bind(this)
			);
		},

		deletePalIdFromSerial: function (oPallet) {

			return new Promise(function (resolve, reject) {

				var sGroup = "deletePalIdFromSerial";
				this.getModel("erp").setDeferredGroups([sGroup]);

				var mParameter = {
					groupId: sGroup,
					success: function (oData) {
						resolve(oData);
					},
					error: function (oError) {
						reject(oError);
					}
				};

				oPallet.getSerialList().forEach(function (oSerial) {

					if (oSerial.fracture) {

						this.getModel("erp").create("/SerialMasterSet", {
							Guid: oSerial.Guid,
							Matnr: oSerial.Matnr,
							Sernr: oSerial.Sernr,
							Vergkz: "5",
							Tanum: this.getModel("app").getProperty("/Data/Tanum")
						}, {
							groupId: sGroup
						});

						var sPath = this.getModel("erp").createKey("/SerialAddSet", {
							Guid: oSerial.Guid,
							Type: "PALID"
						});
						this.getModel("erp").remove(sPath, {
							groupId: sGroup
						});
						
						if (oSerial.macId) {
							sPath = this.getModel("erp").createKey("/SerialAddSet", {
								Guid: oSerial.Guid,
								Type: "MACID"
							});
							this.getModel("erp").remove(sPath, {
								groupId: sGroup
							});
						}
						
					}

				}.bind(this));

				this.getModel("erp").submitChanges(mParameter);

			}.bind(this));
		},

		readEmployee: function (sIdent, fnSuccess) {

			return new Promise(function (resolve, reject) {

				this.getModel("app").setProperty("/Employee/ID", sIdent);

				// var sReadUrl = "/CheckSet('" + sInput + "')";
				var sReadUrl = "/UserSet";

				var oCmrRefFilter = new sap.ui.model.Filter({
					path: "Ident",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: sIdent
				});

				this.getModel("erp").read(sReadUrl, {
					filters: [
						oCmrRefFilter
					],
					success: function (oData) {
						resolve(oData);
					}.bind(this),
					error: function (oError) {
						reject(oError);
					}.bind(this)
				});

			}.bind(this));
		},

		sendConfirmation: function (oData) {

			return new Promise(function (resolve, reject) {

				// this.getModel("erp").setHeaders({
				// 	mandt: this.getModel("app").getProperty("/Data/Client")
				// });

				this.getModel("erp").callFunction("/SendConfirmation", {
					method: "POST",
					urlParameters: {
						PalId: oData.palId,
						Lgnum: this.getModel("app").getProperty("/Data/Lgnum"),
						Tanum: this.getModel("app").getProperty("/Data/Tanum")
					},
					success: function (oDataLoc, response) {
						resolve(oDataLoc);
					},
					error: function (oError) {
						reject(oError);
					}
				});

			}.bind(this));
		},

		initMessageManager: function () {

			var oManager, oView;
			oView = this.getView();
			oManager = sap.ui.getCore().getMessageManager();
			oView.setModel(oManager.getMessageModel(), "message");
			oManager.registerObject(oView, true);
		},

		getMessagePopover: function () {

			if (!this._oMessagePopover) {
				this._oMessagePopover = sap.ui.xmlfragment(this.getView().getId(), "de.arvato.GRModul10.fragment.MessagePopover", this);
				this.getView().addDependent(this._oMessagePopover);
			}
			return this._oMessagePopover;
		},

		onMessagePopoverPress: function (oEvent) {
			this.getMessagePopover().openBy(oEvent.getSource());
		},

		getMessage: function (sType, sText) {
			return new Message({
				message: sText,
				type: sType,
				processor: this.getView().getModel("message")
			});
		},

		getMessageErrorValue: function (oError) {
			var oText = JSON.parse(oError.responseText);
			return oText.error.message.value;
		},

		setWorkMode: function (sMode) {
			this.getModel("app").setProperty("/WorkMode/Current", sMode);
		},

		getWorkMode: function (sMode) {
			//var sWorkMode = this.getModel("app").getProperty("/WorkMode/Current");
			//return sWorkMode ? sWorkMode : WORKMODE_INDEPENDENT;
			return this._determineWorkMode();
		},

		_determineWorkMode: function () {

			var sWorkMode = WORKMODE_INDEPENDENT;

			// Falls App von extern angestossen wurde, koennen Parameter uebergeben worden sein.
			var oComponentData = this.getOwnerComponent().getComponentData();
			if (oComponentData) {
				if (oComponentData.hasOwnProperty("startupParameters")) {

					// Entscheidung, im welchen Arbeitsmodus soll App ausgefuehrt werden!?
					// 1. Modus: Angestossen durch VorApp (FutureWE) mit Parametern (z.B. DocItemID)
					//    => Holen Daten per Entity DocItemSet (OData Service ZPHA_GR_DEFAULT_SRV)
					// 2. Modus: Angestossen separat als eingenstaendige App
					//    => Voraussetzung ist Eingabe von Mandant/Material
					//
					// Allgemein: PO muss bei allen Modus eingegeben werden.
					var sItemId = oComponentData.startupParameters['ItemId'];
					if (sItemId) {
						sWorkMode = WORKMOD_FUTUREWE;
					}
				}
			}
			return sWorkMode;
		},

		getRouter: function () {
			return this.getOwnerComponent().getRouter();
		},

		getModel: function (oModel) {
			return this.getOwnerComponent().getModel(oModel);
		},

		setModel: function (oModel, sName) {
			return this.getView().setModel(oModel, sName);
		},

		getResourceBundle: function () {
			return this.getOwnerComponent().getModel("i18n").getResourceBundle();
		},

		get2FieldInputDialog: function (oContext) {

			if (!this._o2FieldInputDialog) {

				var oInput1 = new sap.m.Input({
					value: oContext.bindPath1,
					submit: function (oEvent) {
						//oContext.onSubmit(oEvent.getParameter("value"));
						//oEvent.getSource().getParent().close();
					}.bind(this)
				});

				var oInput2 = new sap.m.Input({
					value: oContext.bindPath2,
					submit: function (oEvent) {
						//oContext.onSubmit(oEvent.getParameter("value"));
						//oEvent.getSource().getParent().close();
					}.bind(this)
				});

				this._o2FieldInputDialog = new sap.m.Dialog({
					title: oContext.title,
					type: 'Message',
					content: [
						new sap.m.Label({
							text: oContext.label1Text
						}),
						oInput1,
						new sap.m.Label({
							text: oContext.label2Text
						}),
						oInput2
					],
					beginButton: new sap.m.Button({
						text: 'Übernehmen',
						press: function () {
							oContext.onPress({
								value1: oInput1.getValue(),
								value2: oInput2.getValue()
							});
							this._o2FieldInputDialog.close();
						}.bind(this)
					})
				});

				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._o2FieldInputDialog);
			}

			return this._o2FieldInputDialog;
		},

		getInputDialog: function (oContext) {

			if (!this._oInputDialog) {

				var oInput = new sap.m.Input({
					value: oContext.bindPath,
					submit: function (oEvent) {
						oContext.onSubmit(oEvent.getParameter("value"));
						oEvent.getSource().getParent().close();
					}.bind(this)
				});

				this._oInputDialog = new sap.m.Dialog({
					title: oContext.title,
					type: 'Message',
					content: [new sap.m.Label({
						text: oContext.labelText
					}), oInput],
					beginButton: new sap.m.Button({
						text: 'Übernehmen',
						press: function () {
							oInput.fireEvent("submit", {
								value: oInput.getValue()
							});
							this._oInputDialog.close();
						}.bind(this)
					})
				});

				// connect dialog to view (models, lifecycle)
				this.getView().addDependent(this._oInputDialog);
			}

			return this._oInputDialog;
		},

		onGoToSemanticObject: function (oEvent) {

			this.goToSemanticObject({
				SemanticObject: oEvent.getSource().data("SemanticObject"),
				Action: oEvent.getSource().data("action"),
				Parameters: {
					"EmployeeID": this.getModel("app").getProperty("/Employee/ID")
				}
			});
		},

		// goToSemanticObject: function (oData) {

		// 	if (sap.ushell) {
		// 		this.oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
		// 		this.oCrossAppNav.toExternal({
		// 			target: {
		// 				semanticObject: oData.SemanticObject,
		// 				action: oData.Action
		// 			},
		// 			params: oData.Parameters
		// 		});
		// 	}

		// },

		goToSemanticObject: function (oData) {

			if (sap.ushell) {
				this.oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
				var hash = (this.oCrossAppNav && this.oCrossAppNav.hrefForExternal({
					target: {
						semanticObject: oData.SemanticObject,
						action: oData.Action
					},
					params: oData.Parameters
				})) || "";

				this.oCrossAppNav.toExternal({
					target: {
						shellHash: hash
					}
				});
			}
		},

		clearViewContext: function (sViewName) {

			var oModel = this.getModel("app");

			if (!sViewName) {
				oModel.setProperty("/Data/Tanum", "");
				oModel.setProperty("/Data/Ponum", "");
				oModel.setProperty("/Data/ReceivedAmount", "");
				oModel.setProperty("/Data/PalID", "");
				oModel.setProperty("/Data/MacID", "");
				oModel.setProperty("/Data/SerialID", "");
				oModel.setProperty("/Data/FractureSerial", []);
				oModel.setProperty("/Data/pallet", undefined);

				oModel.setProperty("/State/PONumberCaptured", false);
				oModel.setProperty("/State/MasterCartonScanSuccess", false);
				oModel.setProperty("/State/SerialNumberScanSuccess", false);

				oModel.setProperty("/State/FractureMasterCartonInputEditable", false);
				oModel.setProperty("/State/FractureSerialIDInputEditable", false);

				sap.ui.getCore().getMessageManager().removeAllMessages();
				this.getModel("erp").removeData();
			} else {

				switch (sViewName) {
				case "de.arvato.GRModul10.view.Main":

					oModel.setProperty("/Data/Tanum", "");
					break;

				case "de.arvato.GRModul10.view.SumCheck":

					oModel.setProperty("/Data/Ponum", "");
					//oModel.setProperty("/State/PONumberCaptured", false);
					oModel.setProperty("/Data/ReceivedAmount", "");
					oModel.setProperty("/Data/PalID", "");
					break;

				case "de.arvato.GRModul10.view.SampleCheck":

					oModel.setProperty("/State/MasterCartonScanSuccess", false);
					oModel.setProperty("/State/SerialNumberScanSuccess", false);
					oModel.setProperty("/Data/MacID", "");
					oModel.setProperty("/Data/SerialID", "");

					break;
				}
			}
		},

		onNavBack: function () {
			var oPreviousHash = History.getInstance().getPreviousHash(),
				oService = sap.ushell.Container.getService("CrossApplicationNavigation");
			if (oPreviousHash !== undefined || !oService.isInitialNavigation()) {
				history.go(-1);
			} else {
				this.getRouter().navTo("master", {}, true);
			}
		},

		showMessagePalletNotFullRelefance: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.PalletNotRelevantForFull", [oContext.Matnr, oContext.Sernp]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.PalletTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		},

		showMessageMacIDWrong: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.MasterCartonNotFound", [oContext.MacID]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.MasterCartonTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		},

		showMessagePalletNotFound: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.PalletNotFound", [oContext.palId, oContext.matNr]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.PalletTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		},

		showMessageMacIdEntetred: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.MacIdEntetred"), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.MasterCartonTitle"),
					actions: [MessageBox.Action.OK]
				}
			);
		},

		showMessagePalletWasChecked: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText("Message.PalletWasChecked", [oContext.palId]), {
					icon: MessageBox.Icon.ERROR,
					title: this.getResourceBundle().getText("Message.PalletTitle"),
					actions: [MessageBox.Action.OK],
					onClose: function (oAction) {
						oContext.onClose();
					}
				}
			);
		},

		showMessageYesNo: function (oContext) {
			MessageBox.show(
				this.getResourceBundle().getText(oContext.text), {
					icon: MessageBox.Icon.QUESTION,
					title: this.getResourceBundle().getText("Message"),
					actions: [MessageBox.Action.YES, MessageBox.Action.NO],
					onClose: function (sAction) {
						switch (sAction) {
						case MessageBox.Action.YES:
							oContext.onYesAction();
							break;
						case MessageBox.Action.No:
							oContext.onNoAction();
							break;
						}
					}
				}
			);
		}
	});
});