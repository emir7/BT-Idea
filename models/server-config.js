module.exports = class ServerConfig {
    constructor(HZ_PORT, SOCKET_PORT, IP, CONFIG_SERVER_ADDRESS) {
        this.HZ_PORT = Number(HZ_PORT);
        this.SOCKET_PORT = Number(SOCKET_PORT);
        this.IP = IP;
        this.CONFIG_SERVER_ADDRESS = CONFIG_SERVER_ADDRESS;
    }

    toJSON() {
        return {
            HZ_PORT: this.HZ_PORT,
            IP: this.IP,
            SERVER_ADDRESS: `http://${this.IP}:${this.SOCKET_PORT}`,
            SOCKET_PORT: this.SOCKET_PORT,
            CONFIG_SERVER_ADDRESS: this.CONFIG_SERVER_ADDRESS
        };
    }
}