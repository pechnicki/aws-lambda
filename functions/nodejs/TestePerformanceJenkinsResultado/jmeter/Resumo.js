const Estatisticas = require("./Estatisticas");

module.exports = class Resumo extends Estatisticas {
    constructor(tipo, rotulo, registros) {
        const elapsed = [];
        const registrosComRotulo = registros.filter(
            (r) => r["label"] == rotulo
        );
        registrosComRotulo.forEach((r) => {
            elapsed.push(parseFloat(r["elapsed"]));
        });

        super(elapsed);

        this.tipo = tipo;
        this.rotulo = rotulo;

        this.amostras = registrosComRotulo.length;
        this.sucessos = registrosComRotulo.filter(
            (r) => r["success"] === "true"
        ).length;
        this.erros = registrosComRotulo.filter(
            (r) => r["success"] !== "true"
        ).length;

        console.log(
            tipo +
                " - " +
                this.amostras +
                " - " +
                this.sucessos +
                " - " +
                this.erros +
                ' - "' +
                this.rotulo +
                '"'
        );
    }
};
