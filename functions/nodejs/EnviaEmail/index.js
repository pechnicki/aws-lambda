/* Amplify Params - DO NOT EDIT
	ENV
	REGION
	TOKEN_URL
	EMAIL_URL
Amplify Params - DO NOT EDIT */
exports.handler = async (event) => {
  let body = {};
  let statusCode = 200;
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };
  try {
    if (!event.httpMethod) {
      throw new Error(`httpMethod is required: POST`);
    }
    if (event.httpMethod.toUpperCase() !== "POST") {
      throw new Error(`Unsupported method: "${event.httpMethod}"`);
    }
    if (!event.body) {
      throw new Error("Request without body");
    }
    if (typeof event.body === "string") {
      event.body = JSON.parse(event.body);
    }
    const missingFields = [];
    if (!event.body.aplicacao) {
      missingFields.push("aplicacao");
    }
    if (!event.body.unidadeNegocio) {
      missingFields.push("unidadeNegocio");
    }
    if (!event.body.centroCusto) {
      missingFields.push("centroCusto");
    }
    if (!event.body.de) {
      missingFields.push("de");
    }
    if (!event.body.para && !event.body.cc && !event.body.cco) {
      missingFields.push("'para','cc' ou 'cco'");
    }
    if (missingFields.length > 0) {
      throw new Error(
        "Campos obrigatórios que não existem no payload: " + missingFields
      );
    }

    const https = require("https");
    const axios = require("axios");
    const aws = require("aws-sdk");

    const { Parameters } = await new aws.SSM()
      .getParameters({
        Names: ["userToken", "pwdToken"].map(
          (secretName) => process.env[secretName]
        ),
        WithDecryption: true,
      })
      .promise();
    const userToken = Parameters.find((p) =>
      p.Name.endsWith("userToken")
    ).Value;
    const pwdToken = Parameters.find((p) => p.Name.endsWith("pwdToken")).Value;

    const request = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });
    const token = await request
      .post(
        `${process.env.TOKEN_URL}/access-token`,
        { grant_type: "client_credentials" },
        {
          auth: {
            username: userToken,
            password: pwdToken,
          },
          headers: {
            "Content-Type": "application/json",
          },
        }
      )
      .catch((error) => {
        throw new Error("Erro na requisição do token: " + error);
      });

    if (token.data.access_token) {
      let para = [];
      if (event.body.para && Array.isArray(event.body.para)) {
        event.body.para.forEach((email) => {
          para.push({ emailRecebedor: email });
        });
      }
      let cc = [];
      if (event.body.cc && Array.isArray(event.body.cc)) {
        event.body.cc.forEach((email) => {
          cc.push({ emailRecebedorEmCopia: email });
        });
      }
      let cco = [];
      if (event.body.cco && Array.isArray(event.body.cco)) {
        event.body.cco.forEach((email) => {
          cco.push({ emailRecebedorDeCopiaOculta: email });
        });
      }
      body = await request
        .post(
          `${process.env.EMAIL_URL}/send-email`,
          {
            idAplicacaoUtilizadora: event.body.aplicacao,
            unidadeNegocio: event.body.unidadeNegocio,
            centroDeCustoPagador: event.body.centroCusto,
            assuntoEmail: event.body.assunto || "",
            tipoCorpoEmail: event.body.tipoCorpo || "TEXT",
            corpoEmail: event.body.corpo || "",
            emailDoResponsavelEmEnviar: event.body.de,
            emailsRecebedores: para,
            emailsRecebedoresEmCopia: cc,
            emailsRecebedoresDeCopiaOculta: cco,
          },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token.data.access_token}`,
            },
          }
        )
        .catch((error) => {
          throw new Error("Erro no envio: " + error);
        });
      body = body.data;
    }
  } catch (err) {
    statusCode = 400;
    body = err.message;
  } finally {
    body = JSON.stringify(body);
  }

  return {
    statusCode,
    body,
    headers,
  };
};
