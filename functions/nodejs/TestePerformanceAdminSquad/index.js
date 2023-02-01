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

  let parameters = [];
  let query = "";
  let oneRecord = false;
  try {
    if (event.body && typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }
    switch (event.httpMethod.toUpperCase()) {
      case "DELETE":
        if (event.pathParameters) {
          query = "DELETE FROM teste_performance.squad WHERE id = $1";
          parameters = [event.pathParameters.proxy];
        } else {
          throw new Error("Delete without 'id' is not supported");
        }
        break;
      case "GET":
        // One record
        if (event.pathParameters && event.pathParameters.proxy) {
          query =
            "SELECT s.id, d.empresa, s.departamento, s.nome FROM teste_performance.squad s join departamento d on d.id = s.departamento WHERE s.id = $1";
          parameters = [event.pathParameters.proxy];
          oneRecord = true;
        }
        // All records
        else {
          query = "SELECT * FROM teste_performance.squad";
          if (event.queryStringParameters) {
            if (event.queryStringParameters.filter) {
              const queryFilter = JSON.parse(
                event.queryStringParameters.filter
              );
              let queryNextClause = " WHERE";
              for (const [key, value] of Object.entries(queryFilter)) {
                parameters.push("%" + value + "%");
                query += format(
                  "%s %I::citext LIKE $%s",
                  queryNextClause,
                  key,
                  parameters.length
                );

                queryNextClause = " AND";
              }
            }
            if (event.queryStringParameters.sort) {
              const querySort = JSON.parse(event.queryStringParameters.sort);
              query += format(" ORDER BY %I %s", querySort[0], querySort[1]);
            }
          }
        }
        break;
      case "PUT":
        // Update
        if (event.pathParameters) {
          query =
            "UPDATE teste_performance.squad SET departamento = $2, nome = $3 WHERE id = $1 RETURNING *";
          parameters = [
            event.pathParameters.proxy,
            event.body.departamento,
            event.body.nome,
          ];
          oneRecord = true;
        } else {
          throw new Error("Update without 'id' is not supported");
        }
        break;
      case "POST":
        // Insert
        query =
          "INSERT INTO teste_performance.squad (departamento, nome) VALUES ($1, $2) RETURNING *";
        parameters = [event.body.departamento, event.body.nome];
        oneRecord = true;
        break;
      default:
        throw new Error(`Unsupported method: "${event.httpMethod}"`);
    }
    const payload = {
      database: "portal-performance",
      query: query,
      parameters: parameters,
    };
    console.log(payload);
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
