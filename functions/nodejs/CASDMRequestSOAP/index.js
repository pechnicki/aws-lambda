const aws = require("aws-sdk");
const { Parameters } = await new aws.SSM()
  .getParameters({
    Names: ["SDMUser", "SDMPWD"].map(
      (secretName) => process.env[secretName]
    ),
    WithDecryption: true,
  })
  .promise();
const SDMUser = Parameters.find((p) =>
  p.Name.endsWith("SDMUser")
).Value;
const SDMPWD = Parameters.find((p) =>
  p.Name.endsWith("SDMPWD")
).Value;

const SDM = require("./SDM");
const SDMConfig = {
  user: SDMUser,
  password: SDMPWD,
  url: process.env.SDM_URL,
};

exports.handler = async (event) => {
  let body = [];
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };

  const sdm = new SDM(SDMConfig);
  try {
    const allRequests = {};
    await sdm.getLoginSid();
    for (const [key, request] of Object.entries(event)) {
      allRequests[key] = request;
      allRequests[key]["result"] = await processRequest(
        sdm,
        request,
        allRequests
      );
    }
    body = allRequests;
  } catch (err) {
    console.error(err.response.status);
    const errorInfo = sdm.parseXml(err.response.data)["soapenv:Envelope"][
      "soapenv:Body"
    ]["soapenv:Fault"]["detail"];

    statusCode = err.response.status;
    body = {
      errorMessage: errorInfo["ErrorMessage"],
      errorCode: errorInfo["ErrorCode"],
    };
  } finally {
    await sdm.logout();
    headers["Access-Control-Expose-Headers"] = "Content-Range";
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};

async function processRequest(SDM, request, allRequests) {
  let where = request.where;
  // caso o where seja um dicionario o código vai usar
  // os valores para montar a string do where
  if (
    typeof where != "string" &&
    allRequests[request.where.object] &&
    allRequests[request.where.object].result
  ) {
    const objectResult = allRequests[request.where.object].result;
    switch (request.where.condition) {
      case "IN":
        where = `${request.where.attribute} IN (`;
        for (const [key, rows] of Object.entries(objectResult)) {
          let value = rows[0][request.where.objectAttribute];
          if (request.where.objectAttribute == "persistent_id") {
            value = value.split(":")[1];
          }
          where += `'${value}',`;
        }
        where = where.replace(/,$/, ")");
        break;
      default:
        throw new Error(`Unsupported condition: "${request.where.condition}"`);
    }
  }
  // requisicao ao SDM
  let result;
  switch (request.requestMethod) {
    case "doQuery":
      result = await SDM.doQueryRequest(
        request.object,
        where,
        request.attributes
      );
      break;
    default:
      throw new Error(`Unsupported method: "${request.requestMethod}"`);
  }
  if (result && request.mapKey) {
    result = SDM.convertListToMap(result, request.mapKey);
  }
  return result;
}
