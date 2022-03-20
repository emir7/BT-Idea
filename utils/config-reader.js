const dotenv = require('dotenv');

const ServerConfig = require('../models/server-config');

dotenv.config();

module.exports.readConfig = () => {
    const { HZ_PORT, SOCKET_PORT, IP, CONFIG_SERVER_ADDRESS } = process.env;

    return new ServerConfig(HZ_PORT, SOCKET_PORT, IP, CONFIG_SERVER_ADDRESS);
};