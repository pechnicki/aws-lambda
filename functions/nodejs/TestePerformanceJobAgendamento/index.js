const https = require("https");
const axios = require("axios");
const fs = require("fs");
const aws = require("aws-sdk");

exports.handler = async (event) => {
  let body = {};
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

    const { Parameters } = await new aws.SSM()
      .getParameters({
        Names: ["jenkinsToken", "jenkinsUser"].map(
          (secretName) => process.env[secretName]
        ),
        WithDecryption: true,
      })
      .promise();
    const jenkinsUser = Parameters.find((p) =>
      p.Name.endsWith("jenkinsUser")
    ).Value;
    const jenkinsToken = Parameters.find((p) =>
      p.Name.endsWith("jenkinsToken")
    ).Value;

    const jenkinsUrl = `https://${jenkinsUser}:${jenkinsToken}@${process.env.JENKINS_URL}`;
    const jenkins = axios.create({
      baseURL: jenkinsUrl,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    // pega todos os jobs da pasta
    const allJenkinsJobs = await jenkins
      .get("/api/json")
      .then((res) => res.data.jobs);

    let deleteJenkinsJob;
    switch (event.httpMethod.toUpperCase()) {
      case "DELETE":
        if (event.pathParameters) {
          const jobId = event.pathParameters.proxy;
          if (allJenkinsJobs.find((jJob) => jJob.name === jobId)) {
            deleteJenkinsJob = await jenkins.delete("/job/" + jobId);
            console.log("(" + jobId + ") delete: " + deleteJenkinsJob.status);
            statusCode = deleteJenkinsJob.status;
          } else {
            statusCode = 404;
            body = { message: "Job not found" };
          }
        } else {
          throw new Error("Delete without 'id' is not supported");
        }
        break;
      case "POST":
        const job = event.body.job;
        const planoTeste = event.body.planoTeste;

        if (new Date(job.agendamento) > new Date()) {
          const agendamento = changeTimeZone(job.agendamento);
          // deleta o job atual se existir para
          // remover a build agendada anteriormente
          if (allJenkinsJobs.find((jJob) => jJob.name === job.id)) {
            deleteJenkinsJob = await jenkins.delete("/job/" + job.id);
            console.log("(" + job.id + ") delete: " + deleteJenkinsJob.status);
          }

          // cria job
          const jobConfigXmlTemplate = fs
            .readFileSync("./templates/jobCreate.xml", "utf8")
            .replace(/[\t\n\r]/g, "")
            .replace("#CRON_EXPRESSION", dateToCron(agendamento))
            .replace("#REPOSITORIO", job.repositorio)
            .replace("#BRANCH", job.branch)
            .replace("#SCRIPT", job.script)
            .replace("#THREADS", planoTeste.threads)
            .replace("#RAMPA", planoTeste.rampa)
            .replace("#DURACAO", planoTeste.duracao)
            .replace("#ATRASO_INICIALIZACAO", planoTeste.atraso_inicializacao)
            .replace("#JANELA_EXECUCAO", 15)
            .replace("#SQUAD", job.squad)
            .replace("#DEPARTAMENTO", job.departamento)
            .replace("#EMPRESA", job.empresa)
            .replace("#API_URL", process.env.API_URL)
            .replace("#API_ID", process.env.API_ID)
            .replace("#S3_BUCKET", process.env.S3_BUCKET);
          const createJenkinsJob = await jenkins
            .post("/createItem?name=" + job.id, jobConfigXmlTemplate, {
              headers: { "Content-Type": "application/xml" },
            })
            .then((res) => res);
          console.log("(" + job.id + ") create: " + createJenkinsJob.status);
          statusCode = createJenkinsJob.status;
        }
        break;
      case "PUT":
        if (event.pathParameters) {
          const jobId = event.pathParameters.proxy;
          if (allJenkinsJobs.find((jJob) => jJob.name === jobId)) {
            const jobConfig = await jenkins
              .get("/job/" + jobId + "/config.xml")
              .then((res) =>
                res.data.replace(
                  /<disabled>.*<\/disabled>/,
                  "<disabled>" + event.body.disabled + "</disabled>"
                )
              );

            const updateJenkinsJob = await jenkins.post(
              "/job/" + jobId + "/config.xml",
              jobConfig,
              {
                headers: { "Content-Type": "application/xml" },
              }
            );
            console.log(
              "(" +
                jobId +
                ") " +
                (event.body.disabled ? "disabled" : "enabled") +
                ": " +
                updateJenkinsJob.status
            );
            statusCode = updateJenkinsJob.status;
          } else {
            statusCode = 404;
            body = { message: "Job not found" };
          }
        } else {
          throw new Error("Put without 'id' is not supported");
        }
      default:
        break;
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

const changeTimeZone = (date, timeZone = "America/Sao_Paulo") => {
  if (typeof date === "string") {
    return new Date(
      new Date(date).toLocaleString("en-US", {
        timeZone,
      })
    );
  }

  return new Date(
    date.toLocaleString("en-US", {
      timeZone,
    })
  );
};

const dateToCron = (date) => {
  const minutes = date.getMinutes();
  const hours = date.getHours();
  const days = date.getDate();
  const months = date.getMonth() + 1;
  const dayOfWeek = date.getDay();

  return `${minutes} ${hours} ${days} ${months} ${dayOfWeek}`;
};
