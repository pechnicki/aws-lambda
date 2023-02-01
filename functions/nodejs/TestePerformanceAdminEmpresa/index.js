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
  const filters = {
    id: { parse: (v) => v, comparison: "IN" },
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
          query = "DELETE FROM teste_performance.empresa WHERE id = $1";
          parameters = [event.pathParameters.proxy];
        } else {
          throw new Error("Delete without 'id' is not supported");
        }
        break;
      case "GET":
        // One record
        if (event.pathParameters && event.pathParameters.proxy) {
          query = "SELECT * FROM teste_performance.empresa WHERE id = $1";
          parameters = [event.pathParameters.proxy];
          oneRecord = true;
        }
        // All records
        else {
          query = "SELECT * FROM teste_performance.empresa";
          if (event.queryStringParameters) {
            if (event.queryStringParameters.filter) {
              let queryFilter = event.queryStringParameters.filter;
              if (typeof queryFilter === "string") {
                queryFilter = JSON.parse(event.queryStringParameters.filter);
              }
              let queryNextClause = " WHERE";
              for (const [key, value] of Object.entries(queryFilter)) {
                if (key in filters) {
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
                  }
                } else {
                  parameters.push("%" + value + "%");
                  query += format(
                    "%s %I::citext LIKE $%s",
                    queryNextClause,
                    key,
                    parameters.length
                  );
                }
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
            "UPDATE teste_performance.empresa SET nome = $2 WHERE id = $1 RETURNING *";
          parameters = [event.pathParameters.proxy, event.body.nome];
          oneRecord = true;
        } else {
          throw new Error("Update without 'id' is not supported");
        }
        break;
      case "POST":
        // Insert
        query = "INSERT INTO teste_performance.empresa (nome) VALUES ($1) RETURNING *";
        parameters = [event.body.nome];
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
