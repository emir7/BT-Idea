module.exports = class Filter {
    constructor(a, b) {
        this.a = a;
        this.b = b;
    }

    toJSON() {
        return {
            a: this.a,
            b: this.b
        };
    }
}