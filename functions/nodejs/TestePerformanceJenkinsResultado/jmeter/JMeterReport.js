const moment = require("moment");
const { parse } = require("csv-parse/sync");
const JanelaExecucao = require("./JanelaExecucao");
const Detalhes = require("./Detalhes");
const Pacotes = require("./Pacotes");
const Resumo = require("./Resumo");

const NUMBER_OF_SAMPLES_IN_TRANSACTION = "Number of samples in transaction";
const RELATORIO = "relatorio";
const TRANSACAO = "transacao";
const REQUISICAO = "requisicao";
const DIVISOR = "-------------------------------------------";
const DATE_FORMAT = "DD/MM/yyyy HH:mm:ss.SSS";

module.exports = class JMeterReport {
    constructor(arquivoResultado, janelaExecucao) {
        this.janelas_execucao = [];
        this.detalhes = [];
        this.pacotes = [];
        this.resumos = [];
        console.log("Iniciando interpretação dos resultados:");
        console.log(DIVISOR);
        const registros = parse(arquivoResultado, {
            columns: true,
            skip_empty_lines: true,
        }).sort((a, b) => (a["timeStamp"] < b["timeStamp"] ? -1 : 1));

        if (registros) {
            const transacoes = registros.filter((r) =>
                r["responseMessage"].includes(NUMBER_OF_SAMPLES_IN_TRANSACTION)
            );
            const requisicoes = registros.filter(
                (r) =>
                    !r["responseMessage"].includes(
                        NUMBER_OF_SAMPLES_IN_TRANSACTION
                    )
            );

            moment.locale("pt");
            const inicioTeste = moment(parseInt(registros[0]["timeStamp"]));
            const finalTeste = moment(
                parseInt(registros[registros.length - 1]["timeStamp"])
            );

            const duracaoTeste = finalTeste.diff(inicioTeste) / 1000;

            console.log("Total de registros  : " + registros.length);
            console.log("Total de transacoes : " + transacoes.length);
            console.log("Total de requisicoes: " + requisicoes.length);
            console.log(
                "Início              : " + inicioTeste.format(DATE_FORMAT)
            );
            console.log(
                "Final               : " + finalTeste.format(DATE_FORMAT)
            );
            console.log("Duração do teste (s): " + duracaoTeste);

            let inicioJanela = inicioTeste.clone();
            let finalJanela = inicioTeste.clone().add({
                s: janelaExecucao,
                ms: -1,
            });

            const iteracoes = parseInt(duracaoTeste / janelaExecucao);

            console.log(DIVISOR);
            console.log(
                "Janela de execução     : " + janelaExecucao + " segundos"
            );
            console.log("Quantidade de iterações: " + iteracoes);
            for (let iteracao = 0; iteracao <= iteracoes; iteracao++) {
                if (finalJanela > finalTeste) {
                    finalJanela = finalTeste.clone();
                }
                this.janelas_execucao.push(
                    new JanelaExecucao(
                        RELATORIO,
                        duracaoTeste,
                        inicioJanela,
                        finalJanela,
                        registros
                    )
                );
                this.janelas_execucao.push(
                    new JanelaExecucao(
                        TRANSACAO,
                        duracaoTeste,
                        inicioJanela,
                        finalJanela,
                        transacoes
                    )
                );
                this.janelas_execucao.push(
                    new JanelaExecucao(
                        REQUISICAO,
                        duracaoTeste,
                        inicioJanela,
                        finalJanela,
                        requisicoes
                    )
                );

                inicioJanela = inicioJanela.add({ s: janelaExecucao });
                finalJanela = finalJanela.add({ s: janelaExecucao });
            }
            console.log(DIVISOR);
            console.log("Detalhes");
            this.detalhes.push(
                new Detalhes(TRANSACAO, duracaoTeste, transacoes)
            );
            this.detalhes.push(
                new Detalhes(REQUISICAO, duracaoTeste, requisicoes)
            );

            console.log(DIVISOR);
            console.log("Pacotes");
            this.pacotes.push(new Pacotes(TRANSACAO, transacoes));
            this.pacotes.push(new Pacotes(REQUISICAO, requisicoes));

            console.log(DIVISOR);
            console.log("Resumos por rótulos");
            this.distinctLabels(transacoes).forEach((label) =>
                this.resumos.push(new Resumo(TRANSACAO, label, transacoes))
            );
            this.distinctLabels(requisicoes).forEach((label) =>
                this.resumos.push(new Resumo(REQUISICAO, label, requisicoes))
            );
            console.log(DIVISOR);
            console.log("Final da interpretação de resultados");
        }
    }

    toDateTime(milliseconds) {
        let t = new Date(Date.UTC(1970, 0, 1)); // Epoch
        if (typeof milliseconds === "string") {
            t.setUTCMilliseconds(parseInt(milliseconds));
        } else {
            t.setUTCMilliseconds(milliseconds);
        }
        return t;
    }

    distinctLabels(registros) {
        const dlabels = [];
        registros.forEach(
            (r) => dlabels.includes(r["label"]) || dlabels.push(r["label"])
        );
        return dlabels;
    }
};
