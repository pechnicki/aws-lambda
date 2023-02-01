let format = require("pg-format");
const InvokeLambda = require("/opt/nodejs/InvokeLambda");
const lambda = new InvokeLambda();

exports.handler = async (event, context) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };
  try {
    if (event.body && typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }
    let query = "";
    let parameters = [];
    let oneRecord = false;
    switch (event.httpMethod.toUpperCase()) {
      case "DELETE":
        if (event.pathParameters) {
          query = "DELETE FROM administracao.aplicacao WHERE id = $1";
          parameters = [event.pathParameters.proxy];
        } else {
          throw new Error("Delete without 'id' is not supported");
        }
        break;
      case "GET":
        // One record
        if (event.pathParameters) {
          query = "SELECT * FROM administracao.aplicacao WHERE id = $1";
          parameters = [event.pathParameters.proxy];
          oneRecord = true;
        }
        // All records
        else {
          query = "SELECT * FROM administracao.aplicacao";
        }
        if (event.queryStringParameters) {
          if (event.queryStringParameters.sort) {
            const querySort = JSON.parse(event.queryStringParameters.sort);
            query += format(" ORDER BY %I %s", querySort[0], querySort[1]);
          }
        }
        break;
      case "PUT":
        // Update
        if (event.pathParameters) {
          query =
            "UPDATE administracao.aplicacao SET nome = $1, \
                        permite_administrar = $2, permite_editar = $3, \
                        permite_acessar = $4 WHERE id = $5 RETURNING *";
          parameters = [
            event.body.nome,
            event.body.permite_administrar,
            event.body.permite_editar,
            event.body.permite_acessar,
            event.pathParameters.proxy,
          ];
          oneRecord = true;
          break;
        } else {
          throw new Error("Update without 'id' is not supported");
        }
      case "POST":
        // Insert
        query =
          "INSERT INTO administracao.aplicacao \
                    (nome, permite_administrar, permite_editar, permite_acessar) \
                    VALUES ($1,$2,$3,$4) RETURNING *";
        parameters = [
          event.body.nome,
          event.body.permite_administrar,
          event.body.permite_editar,
          event.body.permite_acessar,
        ];
        oneRecord = true;
        break;
      default:
        throw new Error(`Unsupported method: "${event.httpMethod}"`);
    }

    const payload = {
      database: "",
      query: query,
      parameters: parameters,
    };
    body = await lambda
      .invoke(payload, "RequestDB")
      .then((result) => JSON.parse(result.body));

    if (oneRecord) {
      body = body.rows[0];
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    if (body && body.rows) {
      headers["Access-Control-Expose-Headers"] = "Content-Range";
      headers["Content-Range"] = body.rows.length;
      body = body.rows;
    }
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
