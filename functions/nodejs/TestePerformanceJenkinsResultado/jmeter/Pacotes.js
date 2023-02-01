const Estatisticas = require("./Estatisticas");

module.exports = class Pacotes extends Estatisticas {
    constructor(tipo, registros) {
        const sentBytes = [];
        registros.forEach((r) => {
            sentBytes.push(parseFloat(r["sentBytes"]));
        });
        super(sentBytes);

        this.tipo = tipo;
    }
};
