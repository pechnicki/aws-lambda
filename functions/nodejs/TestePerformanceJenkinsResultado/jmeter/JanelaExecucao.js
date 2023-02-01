const Estatisticas = require("./Estatisticas");
const DATE_FORMAT = "yyyy/MM/DD HH:mm:ss.SSS";

module.exports = class JanelaExecucao extends Estatisticas {
    constructor(tipo, duracaoTeste, inicio, final, registros) {
        const registrosDaJanelaExecucao = registros.filter(
            (r) => r["timeStamp"] >= inicio && r["timeStamp"] <= final
        );

        const elapsed = [];
        const allThreads = [];

        registrosDaJanelaExecucao.forEach((r) => {
            elapsed.push(parseFloat(r["elapsed"]));
            allThreads.push(parseFloat(r["allThreads"]));
        });
        super(elapsed);

        this.tipo = tipo;
        this.inicio = inicio.format(DATE_FORMAT);
        this.final = final.format(DATE_FORMAT);
        this.threads = 0;
        if (allThreads.length > 0) {
            this.threads = this.precision(
                allThreads.reduce((a, b) => Math.max(a, b), -Infinity)
            );
        }
        if (registrosDaJanelaExecucao.length == 0) {
            this.registros_por_segundo = 0;
        } else {
            this.registros_por_segundo = this.precision(
                registrosDaJanelaExecucao.length / duracaoTeste
            );
        }
        this.registros = registrosDaJanelaExecucao.length;
        this.erros = registrosDaJanelaExecucao.filter(
            (r) => r["success"] !== "true"
        ).length;
        this.erros_porcentagem = 0;
        if (this.erros != 0) {
            this.erros_porcentagem = this.precision(
                (this.erros / this.registros) * 100
            );
        }

        if (tipo !== "requisicao") {
            tipo += " ";
        }
        console.log(
            tipo +
                " - " +
                this.inicio +
                " - " +
                this.final +
                " - " +
                registrosDaJanelaExecucao.length
        );
    }
};
