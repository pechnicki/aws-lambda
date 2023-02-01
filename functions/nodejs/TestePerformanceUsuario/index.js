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
  try {
    if (event.body && typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }
    switch (event.httpMethod.toUpperCase()) {
      case "GET":
        // One record
        if (event.pathParameters && event.pathParameters.proxy) {
          query = "SELECT * FROM teste_performance.usuario WHERE id = $1";
          parameters = [event.pathParameters.proxy];
        }
        break;
      case "PUT":
        // Update
        if (event.pathParameters) {
          query = `UPDATE teste_performance.usuario SET 
                        nome = $2, 
                        celular = $3, 
                        notificacao = $4, 
                        ultimo_acesso = now()
                        WHERE id = $1 RETURNING *`;
          parameters = [
            event.pathParameters.proxy,
            event.body.nome,
            event.body.celular,
            event.body.notificacao,
          ];
        } else {
          throw new Error("Update without 'id' is not supported");
        }
        break;
      case "POST":
        // Insert
        query = `INSERT INTO teste_performance.usuario (id, nome, email, ultimo_acesso) VALUES ($1, $2, $3, now()) 
                    ON CONFLICT(id) DO UPDATE SET ultimo_acesso = now() 
                    RETURNING *`;
        parameters = [
          event.pathParameters.proxy,
          event.body.nome,
          event.body.email,
        ];
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

    body = body.rows[0];
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
