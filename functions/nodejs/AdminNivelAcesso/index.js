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
    let query = "";
    let parameters = [];
    let oneRecord = false;

    if (event.body && typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }
    switch (event.httpMethod.toUpperCase()) {
      case "DELETE":
        if (event.pathParameters) {
          query = "DELETE FROM administracao.nivel_acesso WHERE id = $1";
          parameters = [event.pathParameters.proxy];
        } else {
          throw new Error("Delete without 'id' is not supported");
        }
        break;
      case "GET":
        // One record
        if (event.pathParameters) {
          query = "SELECT * FROM administracao.nivel_acesso WHERE id = $1";
          parameters = [event.pathParameters.proxy];
          oneRecord = true;
        }
        // All records
        else {
          query = "SELECT * FROM administracao.nivel_acesso ORDER BY id ASC";
        }
        break;
      case "PUT":
        // Update
        if (event.pathParameters) {
          query =
            "UPDATE administracao.nivel_acesso SET \
                            nome = $1, nivel = $2 \
                        WHERE id = $3 RETURNING *";
          parameters = [
            event.body.nome,
            event.body.nivel,
            event.pathParameters.proxy,
          ];
          oneRecord = true;
        } else {
          throw new Error("Update without 'id' is not supported");
        }
        break;
      case "POST":
        // Insert
        query =
          "INSERT INTO administracao.nivel_acesso (nome, nivel) VALUES ($1, $2) RETURNING *";
        parameters = [event.body.nome, event.body.nivel];
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
