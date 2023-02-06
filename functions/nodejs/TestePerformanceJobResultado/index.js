let format = require("pg-format");
const InvokeLambda = require("/opt/nodejs/InvokeLambda");
const lambda = new InvokeLambda();

const PSG_REQUEST_DB = "RequestDB";

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
    let payload = {
      
    };
    switch (event.httpMethod.toUpperCase()) {
      case "POST":
        if (event.pathParameters) {
          const table = event.body.table;
          let data = event.body.data;
          if (typeof data === "string") {
            data = JSON.parse(data);
          }
          // obtem as colunas das chaves do json
          const columns = "job," + Object.keys(data[0]).join(",");
          parameters = [event.pathParameters.proxy];
          query = format("INSERT INTO teste_performance.%s (%s) VALUES ", table, columns);
          // itera nos dados para obter os valores
          // e montar a sql
          data.forEach((row) => {
            query += "($1,";
            Object.keys(row).map((key) => {
              parameters.push(row[key]);
              query += "$" + parameters.length + ",";
            });
            query = query.replace(/,$/, "),");
          });

          query = query.replace(/,$/, " RETURNING *");

          payload = {
            ...payload,
            query: query,
            parameters: parameters,
          };
          console.log(payload);
          body = await lambda
            .invoke(payload, PSG_REQUEST_DB)
            .then((result) => JSON.parse(result.body));
        }
        break;
      case "GET":
        if (event.pathParameters) {
          payload = {
            ...payload,
            parameters: [event.pathParameters.proxy],
          };
          const job_detalhes = {
            ...payload,
            query: "SELECT * FROM job_detalhes WHERE job = $1",
          };
          const job_janelas_execucao = {
            ...payload,
            query:
              "SELECT * FROM job_janelas_execucao WHERE job = $1 ORDER BY inicio ASC",
          };
          const job_pacotes = {
            ...payload,
            query: "SELECT * FROM job_pacotes WHERE job = $1",
          };
          const job_resumos = {
            ...payload,
            query:
              "SELECT * FROM job_resumos WHERE job = $1 ORDER BY rotulo asc",
          };
          body = {};
          await Promise.all([
            lambda
              .invoke(job_detalhes, PSG_REQUEST_DB)
              .then((res) => (body["detalhes"] = JSON.parse(res.body).rows)),
            lambda
              .invoke(job_janelas_execucao, PSG_REQUEST_DB)
              .then(
                (res) => (body["janelas_execucao"] = JSON.parse(res.body).rows)
              ),
            lambda
              .invoke(job_pacotes, PSG_REQUEST_DB)
              .then((res) => (body["pacotes"] = JSON.parse(res.body).rows)),
            lambda
              .invoke(job_resumos, PSG_REQUEST_DB)
              .then((res) => (body["resumos"] = JSON.parse(res.body).rows)),
          ]).catch((error) => {
            statusCode = 400;
            body = error;
          });
          console.log(body);
        }
        break;
      default:
        throw new Error(`Unsupported method: "${event.httpMethod}"`);
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    if (body && body.rows) {
      headers["Access-Control-Expose-Headers"] = "Content-Range";
      headers["Content-Range"] = body.length;
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
