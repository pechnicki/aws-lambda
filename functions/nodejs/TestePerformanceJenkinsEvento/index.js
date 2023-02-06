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

  const jobStatus = {
    inicio: "Em execução",
    conclusao: "Concluído",
    erro: "Erro",
  };

  let parameters = [];
  let query = "";
  try {
    if (event.body && typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }
    switch (event.httpMethod.toUpperCase()) {
      case "PUT":
        // Update
        if (event.pathParameters) {
          if (
            event.body.evento !== "inicio" &&
            event.body.evento !== "conclusao"
          ) {
            query = "UPDATE teste_performance.job SET estado = $2";
            parameters = [
              event.pathParameters.proxy,
              jobStatus[event.body.evento],
            ];
            if (event.body.evento === "erro") {
              query += ", inicio = null";
            }
          } else {
            query = format(
              "UPDATE teste_performance.job SET %I = now(), estado = $2",
              event.body.evento
            );
            parameters = [
              event.pathParameters.proxy,
              jobStatus[event.body.evento],
            ];

            if (event.body.evento === "inicio") {
              Object.keys(event.body).forEach((key) => {
                if (key !== "evento") {
                  parameters.push(event.body[key]);
                  query += format(", %s = $%s", key, parameters.length);
                }
              });
            } else if (event.body.evento === "conclusao") {
              // desabilita job
              await lambda.invoke(
                {
                  httpMethod: "PUT",
                  pathParameters: event.pathParameters,
                  body: { disabled: true },
                },
                "TestePerformanceJobAgendamento"
              );
            }
          }
          query += " WHERE id = $1 RETURNING *";
        } else {
          throw new Error("Update without 'id' is not supported");
        }
        break;
      default:
        throw new Error(`Unsupported method: "${event.httpMethod}"`);
    }
    let payload = {
      
      query: query,
      parameters: parameters,
    };
    const update = await lambda
      .invoke(payload, "RequestDB")
      .then((result) => JSON.parse(result.body).rows[0]);

    let status;
    switch (event.body.evento) {
      case "inicio":
        status = "Iniciado";
        break;
      case "conclusao":
        status = "Concluído";
        break;
      case "erro":
        status = "Erro";
        break;
      default:
        status = event.body.evento;
        break;
    }
    // faz envio de email informando o requisitante
    // obtem endereço de e-mail e se ele quer receber notificacao
    payload = {
      
      query: "SELECT email, notificacao FROM teste_performance.usuario where id = $1",
      parameters: [update.usuario],
    };
    const usuario = await lambda
      .invoke(payload, "RequestDB")
      .then((result) => JSON.parse(result.body).rows[0]);
    // envia email se flag de notificacao estiver ativa
    if (usuario.notificacao) {
      await lambda.invoke(
        {
          httpMethod: "POST",
          body: {
            aplicacao: 1,
            unidadeNegocio: 4,
            centroCusto: 3,
            de: process.env.EMAIL_DE,
            para: [usuario.email],
            assunto: `Portal Performance (${update.id}) - ${status}`,
            tipoCorpo: "TEXT",
            corpo: `Teste ${update.id} - ${status}`,
          },
        },
        "EnviaEmail"
      );
    }

    body = update;
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    headers["Access-Control-Expose-Headers"] = "Content-Range";
    headers["Content-Range"] = 1;
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
