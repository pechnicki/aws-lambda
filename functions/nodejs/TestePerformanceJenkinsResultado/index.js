const aws = require("aws-sdk");
const s3 = new aws.S3();

const JMeterReport = require("./jmeter/JMeterReport");
const InvokeLambda = require("/opt/nodejs/InvokeLambda");
const lambda = new InvokeLambda();

const RESULT_LAMBDA = "TestePerformanceJobResultado";

exports.handler = async (event) => {
  let body;
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };
  try {
    switch (event.httpMethod.toUpperCase()) {
      case "POST":
        // atualiza o estado do job
        lambda.invoke(
          {
            
            query: "UPDATE teste_performance.job SET estado = $1 WHERE id = $2",
            parameters: [
              "Interpretando resultados",
              event.pathParameters.proxy,
            ],
          },
          "RequestDB"
        );

        const csvFile = await s3
          .getObject({
            Bucket: process.env.BUCKET,
            Key: `${event.pathParameters.proxy}.csv`,
          })
          .promise();

        let janelaExecucao = 15;
        if (
          event.queryStringParameters &&
          event.queryStringParameters.janela_execucao
        ) {
          janelaExecucao = parseInt(
            event.queryStringParameters["janela_execucao"]
          );
        }
        const jmeterReport = new JMeterReport(
          csvFile.Body.toString("ascii"),
          janelaExecucao
        );
        const payload = {
          httpMethod: event.httpMethod,
          pathParameters: event.pathParameters,
        };
        const job_janelas_execucao = {
          ...payload,
          body: {
            table: "job_janelas_execucao",
            data: JSON.stringify(jmeterReport.janelas_execucao),
          },
        };
        const job_detalhes = {
          ...payload,
          body: {
            table: "job_detalhes",
            data: JSON.stringify(jmeterReport.detalhes),
          },
        };
        const job_pacotes = {
          ...payload,
          body: {
            table: "job_pacotes",
            data: JSON.stringify(jmeterReport.pacotes),
          },
        };
        const job_resumos = {
          ...payload,
          body: {
            table: "job_resumos",
            data: JSON.stringify(jmeterReport.resumos),
          },
        };
        await Promise.all([
          lambda.invoke(job_janelas_execucao, RESULT_LAMBDA),
          lambda.invoke(job_detalhes, RESULT_LAMBDA),
          lambda.invoke(job_pacotes, RESULT_LAMBDA),
          lambda.invoke(job_resumos, RESULT_LAMBDA),
        ])
          .then((responses) => {
            return Promise.all(responses.map((response) => response));
          })
          .then((data) => console.log(data))
          .catch((error) => {
            statusCode = 400;
            body = error;
            lambda.invoke(
              {
                
                query: "UPDATE teste_performance.job SET estado = $1 WHERE id = $2",
                parameters: [
                  "Erro na interpretação de resultados",
                  event.pathParameters.proxy,
                ],
              },
              "RequestDB"
            );
          });
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
