const AWS = require("aws-sdk");

exports.handler = async (event) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };

  const secrets = JSON.parse(
    await getSecret("acesso_banco_principal", process.env.REGION)
  );

  const mssql = require("mssql");
  const mssqlConfig = {
    user: secrets.loginsql,
    password: secrets.passwordsql,
    database: process.env.MSSQL_DB_NAME,
    server: process.env.MSSQL_SERVER,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
    options: {
      trustServerCertificate: true,
    },
  };

  try {
    const pool = await new mssql.ConnectionPool(mssqlConfig).connect();
    const ps = new mssql.PreparedStatement(pool);
    const psValues = {};
    if (event.parameters) {
      event.parameters.forEach((parameter) => {
        console.log(parameter);
        let type;
        switch (parameter["type"]) {
          case "Number":
            type = mssql.Int;
          case "Boolean":
            type = mssql.Bit;
          case "Date":
            type = mssql.DateTime;
          case "Date":
            type = mssql.DateTime;
          case "Buffer":
            type = mssql.VarBinary;
          case "sql.Table":
            type = mssql.TVP;
          default:
            type = mssql.NVarChar;
        }
        ps.input(parameter["name"], type);
        psValues[parameter["name"]] = parameter["value"];
      });
    }
    await ps.prepare(event.query);
    const result = await ps.execute(psValues);
    await ps.unprepare();

    body = result;
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    headers["Access-Control-Expose-Headers"] = "Content-Range";
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};

async function getSecret(secretName, region) {
  const config = { region: region };
  let secret, decodedBinarySecret;
  let secretsManager = new AWS.SecretsManager(config);
  try {
    let secretValue = await secretsManager
      .getSecretValue({ SecretId: secretName })
      .promise();
    if ("SecretString" in secretValue) {
      return (secret = secretValue.SecretString);
    } else {
      let buff = new Buffer(secretValue.SecretBinary, "base64");
      return (decodedBinarySecret = buff.toString("ascii"));
    }
  } catch (err) {
    console.log(err);
    if (err.code === "DecryptionFailureException")
      // Secrets Manager can't decrypt the protected secret text using the provided KMS key.
      // Deal with the exception here, and/or rethrow at your discretion.
      throw err;
    else if (err.code === "InternalServiceErrorException")
      // An error occurred on the server side.
      // Deal with the exception here, and/or rethrow at your discretion.
      throw err;
    else if (err.code === "InvalidParameterException")
      // You provided an invalid value for a parameter.
      // Deal with the exception here, and/or rethrow at your discretion.
      throw err;
    else if (err.code === "InvalidRequestException")
      // You provided a parameter value that is not valid for the current state of the resource.
      // Deal with the exception here, and/or rethrow at your discretion.
      throw err;
    else if (err.code === "ResourceNotFoundException")
      // We can't find the resource that you asked for.
      // Deal with the exception here, and/or rethrow at your discretion.
      throw err;
  }
}
