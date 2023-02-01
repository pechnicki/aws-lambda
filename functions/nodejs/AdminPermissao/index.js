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
    const filters = {
      grupo: { parse: (v) => v, comparison: "IN" },
      aplicacao: { parse: (v) => v, comparison: "IN" },
      nivel_acesso: { parse: (v) => v, comparison: "IN" },
    };

    let query = "";
    let parameters = [];
    let oneRecord = false;

    if (event.body && typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }
    switch (event.httpMethod.toUpperCase()) {
      case "DELETE":
        if (event.pathParameters) {
          query = "DELETE FROM administracao.permissao WHERE id = $1";
          parameters = [event.pathParameters.proxy];
        } else {
          throw new Error("Delete without 'id' is not supported");
        }
        break;
      case "GET":
        // One record
        if (event.pathParameters && event.pathParameters.proxy) {
          query = "SELECT * FROM administracao.permissao WHERE id = $1";
          parameters = [event.pathParameters.proxy];
          oneRecord = true;
        }
        // All records
        else {
          query = "SELECT * FROM administracao.permissao";
          if (event.queryStringParameters) {
            if (event.queryStringParameters.filter) {
              const queryFilter = JSON.parse(
                event.queryStringParameters.filter
              );
              let queryNextClause = " WHERE";
              for (const [key, value] of Object.entries(queryFilter)) {
                if (filters[key].comparison === "IN") {
                  query += format(
                    "%s %I %s (",
                    queryNextClause,
                    key,
                    filters[key].comparison
                  );
                  for (const inValue of value) {
                    parameters.push(inValue);
                    query += format("$%s, ", parameters.length);
                  }
                  query = query.replace(/, $/, ")");
                } else {
                  parameters.push(filters[key].parse(value));
                  query += format(
                    "%s %I %s $%s",
                    queryNextClause,
                    key,
                    filters[key].comparison,
                    parameters.length
                  );
                }
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
            "UPDATE administracao.permissao \
                    SET grupo = $1, aplicacao = $2, nivel_acesso = $3 \
                    WHERE id = $4 RETURNING *";
          parameters = [
            event.body.grupo,
            event.body.aplicacao,
            event.body.nivel_acesso,
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
          "INSERT INTO administracao.permissao (grupo, aplicacao, nivel_acesso) \
                    VALUES ($1, $2, $3) RETURNING *";
        parameters = [
          event.body.grupo,
          event.body.aplicacao,
          event.body.nivel_acesso,
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
