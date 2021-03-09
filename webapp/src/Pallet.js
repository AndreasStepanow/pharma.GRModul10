sap.ui.define([
	"sap/ui/base/Object", "sap/ui/model/json/JSONModel"
], function (Object, JSONModel) {
	"use strict";

	//var SAMPLECHECK_SUCCESSFULL = "2";
	var SAMPLECHECK_NOT_USE = "3";
	var SAMPLECHECK_WRONG = "1";

	var DEFAULT_ASSIGNMENT_INDICATOR = "5";

	return Object.extend("de.arvato.GRModul10.src.Pallet", {

		constructor: function (oData) {

			this.AssignmentIndicator = DEFAULT_ASSIGNMENT_INDICATOR;

			this.palId = oData.palId;
			this.qmChk = oData.qmChk;

			// Fuer die gesamte Palette gilt: 
			//   => 3, falls Pruefung in Ordnung
			//   => 1, falls Pruefung nicht in Ordnung
			this.qmStatus = "";
			this.Customizing = oData.Customizing;

			this.createContext(oData.serialAddList);
			this.createCheckContext(this.Customizing);

			this.model = new JSONModel();
			this.model.setData(this);
		},

		isOpenMacCheckAvailable: function () {
			return this.countMacIdToCheck > 0 ? true : false;
		},

		isOpenSerCheckAvailable: function (sMacId) {

			if (this.getMacCount() > 0) {
				var oMac = this.getMac(sMacId);
				return (oMac && oMac.countSerNrToCheck > 0) ? true : false;
			} else {
				return this.countSerNrToCheck > 0 ? true : false;
			}
		},

		setQMStateForSerial: function (sSernr, sQMState) {
			var oSer = this.getSer(sSernr);
			if (oSer) {
				oSer.QMStatus = sQMState;
			}
		},

		setQMStateForAllSerial: function (sQMState) {

			this.serialList.forEach(function (oSerial) {

				switch (sQMState) {
				case SAMPLECHECK_WRONG:
					oSerial.QMStatus = sQMState;
					this.qmStatus = sQMState;
					break;

				case SAMPLECHECK_NOT_USE:
					if (!oSerial.QMStatus) {
						oSerial.QMStatus = sQMState;
					}
					this.qmStatus = sQMState;
					break;
				}

			}.bind(this));
		},

		/**
		 * Funktion setzt alle offenen Pruefugnen auf 0, wenn z.B. Pruefung einer Serialnummer
		 * fehlgeschlagen wurde!
		 */
		resetChecked: function () {
			this.countMacIdToCheck = 0;
			this.countSerNrToCheck = 0;
			this.macList.forEach(function (oMac) {
				oMac.countSerNrToCheck = 0;
			});
		},

		setMacChecked: function (oMac) {
			oMac = this.getMac(oMac.Value);
			if (oMac) {
				this.countMacIdToCheck--;
				oMac.verified = true;
			}
		},

		setSerialFracture: function (sSerial, bFracture) {
			var oSer = this.getSer(sSerial);
			if (oSer) {
				oSer.fracture = bFracture;
			}
		},

		setSerialChecked: function (oSerial) {

			if (this.getMacCount() > 0) {
				var oMac = this.getMac(oSerial.Parent);
				if (oMac) {
					oMac.countSerNrToCheck--;
				}
			} else {
				this.countSerNrToCheck--;
			}

			var oSer = this.getSer(oSerial.Value);
			if (oSer) {
				oSer.verified = true;
			}
		},

		getMac: function (sMacId) {
			return this.macList.find(function (oLocalMac) {
				return oLocalMac.MacId === sMacId;
			});
		},

		getSer: function (sSernr) {
			return this.serialList.find(function (oLocalSerial) {
				return oLocalSerial.Sernr === sSernr;
			});
		},

		createCheckContext: function (oCustomizingIn) {

			var oCustomizing = oCustomizingIn ? oCustomizingIn : this.Customizing;
			if (!oCustomizing) {
				return;
			}

			if (this.macList && this.macList.length > 0) {

				switch (oCustomizing.SettingMacID.Vltyp) {
				case "1":
					this.countMacIdToCheck = parseInt(this.macList.length * (oCustomizing.SettingMacID.Chkvl / 100), 10);
					break;
				case "2":
					this.countMacIdToCheck = parseInt(oCustomizing.SettingMacID.Chkvl, 10);
					break;
				}

				this.macList.forEach(function (oLocalMac) {

					var countSerNrToCheck = 0;
					switch (oCustomizing.SettingSerNR.Vltyp) {
					case "1":
						countSerNrToCheck = parseInt(oLocalMac.SerialList.length * (oCustomizing.SettingMacID.Chkvl / 100), 10);
						break;
					case "2":
						countSerNrToCheck = parseInt(oCustomizing.SettingSerNR.Chkvl, 10);
						break;
					}

					oLocalMac.countSerNrToCheck = countSerNrToCheck;
				});
			} else {
				this.countSerNrToCheck = parseInt(oCustomizing.SettingSerNR.Chkvl, 10);
				this.countMacIdToCheck = 0;
			}
		},

		createContext: function (oSerialAddList) {

			this.serialList = [];
			this.macList = [];

			if (!oSerialAddList) {
				return;
			}

			oSerialAddList.forEach(function (serialAdd) {

				var sSernr = serialAdd.SerialMaster ? serialAdd.SerialMaster.Sernr.trim() : "";
				var oSerial = {
					Guid: serialAdd.Guid,
					Matnr: serialAdd.SerialMaster ? serialAdd.SerialMaster.Matnr : "",
					Sernr: sSernr,
					QMStatus: ""
				};

				// ----------- MacID Behandlung! ------------------------------------------------
				var aAddList = serialAdd.SerialMaster.SerialAddSet.results;
				var oAddMacId = aAddList.find(function (innerAdd) {
					return innerAdd.Type === "MACID";
				}.bind(this));

				if (oAddMacId) {
					var sMacId = oAddMacId.Value;
					oSerial["macId"] = sMacId;

					var oMac = this.macList.find(function (oLocalMac) {
						return oLocalMac.MacId === sMacId;
					});

					if (!oMac) {
						this.macList.push({
							MacId: sMacId,
							verified: false,
							SerialList: [oSerial],
							countSerNrToCheck: 0
						});
					} else {
						oMac.SerialList.push(oSerial);
					}
				}

				oSerial["verified"] = false;
				this.serialList.push(oSerial);

				// ----------- Pruefung der Palette bereits durchgeführt!?
				var oAddCheck = aAddList.find(function (innerAdd) {
					return (innerAdd.Type === "QMCHK" || innerAdd.Type === "QMSTATUS");
				});
				if (oAddCheck) {
					this.alreadyChecked = true;
				}

			}.bind(this));
		},

		isChecked: function () {
			return this.alreadyChecked;
		},

		getMacList: function () {
			return this.macList;
		},

		getMacCount: function () {
			if (this.getMacList()) {
				return this.getMacList().length;
			} else {
				return 0;
			}
		},

		getSerialList: function () {
			return this.serialList;
		},

		getSerialListForMac: function (sMacID) {
			var oFoundMacId = this.macList.find(function (oLocMac) {
				return oLocMac.MacId === sMacID;
			});
			return oFoundMacId ? oFoundMacId.SerialList : [];
		},

		getQMChk: function () {
			return this.qmChk;
		},

		isSerialVerified: function (sSerial) {

			var oSerial = this.getSer(sSerial);
			if (oSerial && oSerial.verified) {
				return true;
			} else {
				return false;
			}
		},

		isSerialExist: function (sSerial) {

			var oSerial = this.getSer(sSerial);
			//if (oSerial && oSerial.verified === false) {
			if (oSerial) {
				return true;
			} else {
				return false;
			}
		},

		isMacExist: function (sMacId) {
			var oMac = this.getMac(sMacId);
			//if (oMac && oMac.verified === false) {
			if (oMac) {
				return true;
			} else {
				return false;
			}
		},

		isSerialInMac: function (sSerial, sMacId) {
			var oMac = this.macList.find(function (oLocalMac) {
				return oLocalMac.MacId === sMacId;
			});

			if (oMac) {
				var oSerial = oMac.SerialList.find(function (oLocalSerial) {
					return oLocalSerial.Sernr === sSerial;
				});
				if (oSerial) {
					return true;
				} else {
					return false;
				}
			} else {
				return false;
			}
		}
	});
});