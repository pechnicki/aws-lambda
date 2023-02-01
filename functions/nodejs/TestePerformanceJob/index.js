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
          query = "DELETE FROM teste_performance.job WHERE id = $1";
          parameters = [event.pathParameters.proxy];
        } else {
          throw new Error("Delete without 'id' is not supported");
        }
        break;
      case "GET":
        // One record
        if (event.pathParameters && event.pathParameters.proxy) {
          query = "SELECT * FROM teste_performance.view_job WHERE id = $1";
          parameters = [event.pathParameters.proxy];
          oneRecord = true;
        }
        // All records
        else {
          query = "SELECT * FROM teste_performance.view_job";
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
          if (typeof event.body.publico === "boolean") {
            // update public flag
            query =
              "UPDATE teste_performance.job SET publico = $2 WHERE id = $1 RETURNING *";
            parameters = [event.pathParameters.proxy, event.body.publico];
          } else {
            // update whole job content
            query =
              "UPDATE teste_performance.job SET squad = $2, nome = $3, plano_teste = $4, \
                        branch = $5, repositorio = $6, script = $7, agendamento = $8, \
                        estado = $9 WHERE id = $1 RETURNING *";
            parameters = [
              event.pathParameters.proxy,
              event.body.squad,
              event.body.nome,
              event.body.plano_teste,
              event.body.branch,
              event.body.repositorio,
              event.body.script,
              event.body.agendamento,
              event.body.estado,
            ];
          }
          oneRecord = true;
        } else {
          throw new Error("Update without 'id' is not supported");
        }
        break;
      case "POST":
        // Insert
        query = `INSERT INTO teste_performance.job (squad, nome, usuario, plano_teste, \
                    branch, repositorio, script, cadastro, agendamento, estado ) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`;
        parameters = [
          event.body.squad,
          event.body.nome,
          event.body.usuario,
          event.body.plano_teste,
          event.body.branch,
          event.body.repositorio,
          event.body.script,
          event.body.cadastro,
          event.body.agendamento,
          event.body.estado,
        ];
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
