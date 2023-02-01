module.exports = class Estatisticas {
    constructor(data) {
        const ss = require("simple-statistics");

        if (!data || data.length === 0) {
            this.soma = 0;
            this.media = 0;
            this.min = 0;
            this.max = 0;
            this.pct25 = 0;
            this.pct50 = 0;
            this.pct75 = 0;
            this.pct90 = 0;
            this.pct95 = 0;
            this.pct99 = 0;
            this.pct100 = 0;
        } else {
            this.soma = this.precision(ss.sum(data));
            this.media = this.precision(ss.mean(data));
            this.min = this.precision(ss.min(data));
            this.max = this.precision(ss.max(data));
            this.pct25 = this.precision(ss.quantile(data, 0.25));
            this.pct50 = this.precision(ss.quantile(data, 0.5));
            this.pct75 = this.precision(ss.quantile(data, 0.75));
            this.pct90 = this.precision(ss.quantile(data, 0.9));
            this.pct95 = this.precision(ss.quantile(data, 0.95));
            this.pct99 = this.precision(ss.quantile(data, 0.99));
            this.pct100 = this.precision(ss.quantile(data, 1));
        }
    }

    precision(value, digits = 5) {
        return parseFloat(value.toFixed(digits));
    }
};
