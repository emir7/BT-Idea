module.exports = class HZMessage {

    constructor(userId, message, instanceId) {
        this.userId = userId;
        this.message = message;
        this.instanceId = instanceId;
    }

    toJSON() {
        return {
            userId: this.userId,
            message: this.message,
            instanceId: this.instanceId
        };
    }
}