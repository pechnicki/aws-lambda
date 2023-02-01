const fs = require("fs");
const JMeterReport = require("./jmeter/JMeterReport");

const input = fs.readFileSync("./jmeter/e8266daf-02ae-4f26-a385-d314bd571cfc.csv");

const jmeterReport = new JMeterReport(input,15);

//console.log(jmeterReport);
