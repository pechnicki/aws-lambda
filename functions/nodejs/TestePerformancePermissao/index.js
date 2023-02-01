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
    let parameters = [];
    let query = "";
    switch (event.httpMethod.toUpperCase()) {
      case "GET":
        // Get from a single application
        query = "SELECT * FROM teste_performance.view_permissao";
        let groups = ["default"];
        if (
          event.multiValueQueryStringParameters &&
          event.multiValueQueryStringParameters.group
        ) {
          groups = groups.concat(event.multiValueQueryStringParameters.group);
        }
        query += " WHERE grupo::citext IN (";
        groups.forEach((group, index) => {
          query += "$" + (index + 1);
          if (index < groups.length - 1) {
            query += ",";
          }
        });
        query += ")";
        parameters = [...groups];

        query += " AND aplicacao::citext = 'portal-performance'";
        query += " ORDER BY nivel DESC LIMIT 1";

        break;
      default:
        throw new Error(`Unsupported method: "${event.httpMethod}"`);
    }

    const payload = {
      database: "admin-",
      query: query,
      parameters: parameters,
    };
    body = await lambda
      .invoke(payload, "RequestDB")
      .then((result) => JSON.parse(result.body));
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
