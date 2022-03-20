module.exports = class User {
    constructor(id, filters, areFiltersConfigured) {
        this.id = id;
        this.filters = filters;
        this.areFiltersConfigured = areFiltersConfigured;
    }

    toJSON() {
        return {
            id: this.id,
            filters: this.filters.toJSON(),
            areFiltersConfigured: this.areFiltersConfigured 
        };
    }
}