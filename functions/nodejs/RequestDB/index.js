const { Client } = require("pg");
const SecretsManager = require("/opt/nodejs/SecretsManager");
const sm = new SecretsManager();

exports.handler = async (event) => {
  const postgresConfig = {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT,
    database: event.database || "pechnicki",
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PWD,
  };
  const postgres = new Client(postgresConfig);

  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };

  try {
    postgres.connect();
    let postgresResult;
    // mais de uma query na mesma requisicao
    if (Array.isArray(event.query)) {
      body = [];
      for (const [index, query] of event.query.entries()) {
        postgresResult = await postgres.query(query, event.parameters[index]);
        body.push(postgresResult);
      }
    } else {
      postgresResult = await postgres.query(event.query, event.parameters);
      body = postgresResult;
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    postgres.end();
    headers["Access-Control-Expose-Headers"] = "Content-Range";
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
