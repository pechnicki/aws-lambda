const { Agent } = require("https");
const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");

module.exports = class SDM {
    constructor(config) {
        if (SDM._instance) {
            return SDM._instance;
        }
        SDM._instance = this;

        this.username = config.user;
        this.password = config.password;
        this.url = config.url;
        this.loginSid = "";
        const httpsAgent = new Agent({
            rejectUnauthorized: false,
            keepAlive: true,
        });
        this.config = {
            headers: {
                SOAPAction: "",
                "Content-Type": "application/soap+xml",
            },
            httpsAgent: httpsAgent,
        };
        this.hexCodeMap = new Map();
        this.hexCodeMap.set("2013", "-");
    }

    async SDMPost(xml) {
        const postOutput = await axios.post(this.url, xml, this.config);
        return postOutput.data;
    }

    async freeListHandle(listHandle) {
        const xml =
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://www.ca.com/UnicenterServicePlus/ServiceDesk">' +
            "<soapenv:Header/><soapenv:Body><ser:freeListHandles>" +
            `<sid>${this.loginSid}</sid>` +
            `<handles><integer>${listHandle}</integer></handles>` +
            "</ser:freeListHandles></soapenv:Body></soapenv:Envelope>";
        console.log("Freeing list handle: " + listHandle);
        await this.SDMPost(xml);
        return;
    }

    async doQueryRequest(
        objectType,
        whereClause,
        attributeList,
        recordsToFetch = 2000,
        attributeToFilter = null,
        valuesToFilter = []
    ) {
        console.log("(" + objectType + ") Starting request");
        let startIndex = 0;
        const doQueryOutput = await this.doQuery(objectType, whereClause);
        const listHandle = doQueryOutput["listHandle"];
        const listLength = parseInt(doQueryOutput["listLength"], 10);
        let concatenatedOutput = [];
        valuesToFilter = Array.from(valuesToFilter);
        try {
            while (startIndex < listLength) {
                let endIndex = startIndex + recordsToFetch - 1;
                if (listLength - startIndex <= recordsToFetch) {
                    endIndex = -1;
                }
                console.log(
                    "(" +
                        objectType +
                        ") Fetching data: " +
                        startIndex +
                        " - " +
                        endIndex
                );
                let doQueryRequestOutput = await this.getListValues(
                    listHandle,
                    attributeList,
                    startIndex,
                    endIndex
                );
                if (attributeToFilter == null) {
                    concatenatedOutput = [
                        ...concatenatedOutput,
                        ...doQueryRequestOutput,
                    ];
                } else {
                    concatenatedOutput = [
                        ...concatenatedOutput,
                        ...doQueryRequestOutput.filter(
                            (it) =>
                                valuesToFilter.indexOf(it[attributeToFilter]) !=
                                -1
                        ),
                    ];
                }
                startIndex += recordsToFetch;
            }
            if (attributeToFilter != null) {
                console.log(
                    `(${objectType}) Filtered ${concatenatedOutput.length} records out of ${listLength}`
                );
            }
        } catch (err) {
            console.log(
                `(${objectType}) There was a problem retrieving the data: ${err.message}`
            );
        } finally {
            await this.freeListHandle(listHandle);
        }
        return concatenatedOutput;
    }

    async doQuery(objectType, whereClause) {
        const xml =
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://www.ca.com/UnicenterServicePlus/ServiceDesk">' +
            "<soapenv:Header/><soapenv:Body><ser:doQuery>" +
            `<sid>${this.loginSid}</sid>` +
            `<objectType>${objectType}</objectType>` +
            `<whereClause>${whereClause}</whereClause>` +
            "</ser:doQuery></soapenv:Body></soapenv:Envelope>";
        const doQueryContent = this.parseXml(await this.SDMPost(xml));
        const doQueryOutput = [];
        doQueryOutput["listHandle"] =
            doQueryContent["soapenv:Envelope"]["soapenv:Body"][
                "doQueryResponse"
            ]["doQueryReturn"]["listHandle"];
        doQueryOutput["listLength"] =
            doQueryContent["soapenv:Envelope"]["soapenv:Body"][
                "doQueryResponse"
            ]["doQueryReturn"]["listLength"];
        console.log(doQueryOutput);
        return doQueryOutput;
    }

    async getListValues(
        listHandle,
        attributeList,
        startIndex = 0,
        endIndex = -1
    ) {
        let attributes = "";
        for (const attribute of attributeList) {
            attributes += `<string>${attribute}</string>`;
        }
        const xml =
            '<?xml version="1.0" encoding="utf-8"?>' +
            '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://www.ca.com/UnicenterServicePlus/ServiceDesk">' +
            "<soapenv:Header/><soapenv:Body><ser:getListValues>" +
            `<sid>${this.loginSid}</sid>` +
            `<listHandle>${listHandle}</listHandle>` +
            `<startIndex>${startIndex}</startIndex>` +
            `<endIndex>${endIndex}</endIndex>` +
            `<attributeNames>${attributes}</attributeNames>` +
            "</ser:getListValues></soapenv:Body></soapenv:Envelope>";
        const getListValuesContent = this.convertListValuesToList(
            await this.SDMPost(xml)
        );
        return getListValuesContent;
    }

    async getLoginSid() {
        if (this.loginSid == "") {
            const xml =
                '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://www.ca.com/UnicenterServicePlus/ServiceDesk">' +
                "<soapenv:Header/><soapenv:Body><ser:login>" +
                `<username>${this.username}</username>` +
                `<password>${this.password}</password>` +
                "</ser:login></soapenv:Body></soapenv:Envelope>";
            const content = await this.SDMPost(xml);
            this.loginSid =
                this.parseXml(content)["soapenv:Envelope"]["soapenv:Body"][
                    "loginResponse"
                ]["loginReturn"];
        }
        console.log("Login SID: " + this.loginSid);
        return this.loginSid;
    }

    async logout() {
        if (this.loginSid) {
            const xml =
                '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://www.ca.com/UnicenterServicePlus/ServiceDesk">' +
                "<soapenv:Header/><soapenv:Body><ser:logout>" +
                `<sid>${this.loginSid}</sid>` +
                "</ser:logout></soapenv:Body></soapenv:Envelope>";
            console.log("Logging out");
            await this.SDMPost(xml);
        }
        return;
    }

    parseXml(xml) {
        const parser = new XMLParser();
        return parser.parse(xml);
    }

    convertListValuesToList(xml) {
        let convertedList = [];
        const getListValuesContent = this.parseXml(xml);
        const getListValuesReturn = this.parseXml(
            getListValuesContent["soapenv:Envelope"]["soapenv:Body"][
                "getListValuesResponse"
            ]["getListValuesReturn"]
        );
        let UDSObjectList = getListValuesReturn["UDSObjectList"]["UDSObject"];
        if (!Array.isArray(UDSObjectList)) {
            UDSObjectList = [UDSObjectList];
        }
        for (const UDSObject of UDSObjectList) {
            let xmlMap = {};
            for (const attributes of UDSObject["Attributes"]["Attribute"]) {
                xmlMap[attributes["AttrName"]] = this.hexToAscii(
                    attributes["AttrValue"]
                ).replace(/\\n/g, "");
            }
            convertedList.push(xmlMap);
        }
        return convertedList;
    }

    convertListToMap(list, attributeKey) {
        let newMap = {};
        for (const value of list) {
            const newKey = value[attributeKey];
            if (!(newKey in newMap)) {
                newMap[newKey] = [value];
            } else {
                newMap[newKey].push(value);
            }
            delete value[attributeKey];
        }
        return newMap;
    }

    hexToAscii(rawString) {
        let asciiString = rawString.toString();
        const hexCodesFromString = asciiString.match(/&#x[\d\w]*;/g);
        if (hexCodesFromString != null) {
            for (const fullHexCode of hexCodesFromString) {
                const hexCode = fullHexCode.match(/&#x([\d\w]*);/)[1];
                let convertedHexCode = "";
                if (this.hexCodeMap.has(hexCode)) {
                    convertedHexCode = this.hexCodeMap.get(hexCode);
                } else {
                    let hex = hexCode.toString();
                    for (var n = 0; n < hex.length; n += 2) {
                        convertedHexCode += String.fromCharCode(
                            parseInt(hex.substr(n, 2), 16)
                        );
                    }
                    this.hexCodeMap.set(hexCode, convertedHexCode);
                }
                let fullHexCodeRE = new RegExp(fullHexCode, "g");
                asciiString = asciiString.replace(
                    fullHexCodeRE,
                    convertedHexCode
                );
            }
        }
        return asciiString;
    }
};
