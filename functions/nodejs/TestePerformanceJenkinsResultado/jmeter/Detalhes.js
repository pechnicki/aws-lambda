const Estatisticas = require("./Estatisticas");

module.exports = class Detalhes extends Estatisticas {
    constructor(tipo, duracaoTeste, registros) {
        const elapsed = [];
        registros.forEach((r) => {
            elapsed.push(parseFloat(r["elapsed"]));
        });

        super(elapsed);

        this.tipo = tipo;
        this.registros = registros.length;
        this.sucessos = registros.filter((r) => r["success"] === "true").length;
        this.erros = registros.filter((r) => r["success"] !== "true").length;

        if (this.sucessos === 0) {
            this.sucessos_por_segundo = 0;
            this.sucessos_porcentagem = 0;
        } else {
            this.sucessos_por_segundo = this.precision(
                this.sucessos / duracaoTeste
            );
            this.sucessos_porcentagem = this.precision(
                (this.sucessos / this.registros) * 100
            );
        }

        if (this.erros === 0) {
            this.erros_por_segundo = 0;
            this.erros_porcentagem = 0;
        } else {
            this.erros_por_segundo = this.precision(this.erros / duracaoTeste);
            this.erros_porcentagem = this.precision(
                (this.erros / this.registros) * 100
            );
        }

        if (this.registros === 0) {
            this.registros_por_segundo = 0;
        } else {
            this.registros_por_segundo = this.precision(
                this.registros / duracaoTeste
            );
        }

        this.registros_por_minuto = this.precision(
            this.registros_por_segundo * 60
        );
        const registros_por_hora = this.precision(
            this.registros_por_minuto * 60
        );
        this.registros_por_dia = this.precision(registros_por_hora * 24);
        this.registros_por_mes = this.precision(this.registros_por_dia * 31);
        this.registros_por_ano = this.precision(this.registros_por_dia * 365);
        this.registros_por_dia_comercial = this.precision(
            registros_por_hora * 9
        );
        this.registros_por_mes_comercial = this.precision(
            this.registros_por_dia_comercial * 22
        );
        this.registros_por_ano_comercial = this.precision(
            this.registros_por_mes_comercial * 12
        );
    }
};
