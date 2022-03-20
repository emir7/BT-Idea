const { spawn } = require('child_process');

const express = require('express');
const app = express();
const { Server } = require("socket.io");
const http = require('http');
const server = http.createServer(app);
const io = new Server(server);

const path = require('path');

const registrationUtils = require('./utils/register-yourself');
const configReader = require('./utils/config-reader');

const HZClient = require('./hazelcast/hz-client');
const RabbitConsumer = require('./rabbit/rabbit-consumer');
const User = require('./models/user');
const Filter = require('./models/filters');

const connectedClients = new Map();
//TODO SET INSIDE ENV .. AND READ INSIDE RABBIT FILES FROM DOTENV
const rabbitAddress = 'amqp://guest:guest@localhost:5672/';
const q = 'msg-q';

const main = async () => {
    spawn('./hazelcast-5.1/bin/hz-start', {stdio: 'inherit'});

    const serverConfig = configReader.readConfig();
    const { HZ_PORT, SOCKET_PORT, SERVER_ADDRESS, CONFIG_SERVER_ADDRESS } = serverConfig.toJSON();
    
    const hzClient = new HZClient(HZ_PORT);

    await hzClient.init();

    hzClient.on('msg', (data) => {
        const socket = connectedClients.get(data.userId);
        
        if(!socket) {
            return;
        }

        socket.emit('msg', data.message);
    });

    const rabbitConsumer = new RabbitConsumer(rabbitAddress, q);

    await rabbitConsumer.init();

    rabbitConsumer.on('msg', (msg) => {
        const parsedMsgContent = Number(msg.content.toString());
        
        hzClient.filterUsersAndForwardMessage(parsedMsgContent)

        rabbitConsumer.sendAck(msg);
    });

    app.get('/', (_, res) => {
        const clientAppPath = path.join(__dirname, 'public', 'index.html');

        res.sendFile(clientAppPath);
    });

    app.get('/health', (_, res) => {
        res.status(200).send();
    });

    await registrationUtils.registerYourself(SERVER_ADDRESS, CONFIG_SERVER_ADDRESS);

    server.listen(SOCKET_PORT, () => {
        console.log(`SOCKET SERVER IS UP AND RUNNING ON PORT ${SOCKET_PORT}`);
    });

    io.on('connection', async (socket) => {
        connectedClients.set(socket.id, socket);
    
        socket.on('filters', async ({a, b}) => {
            const userId = socket.id;
            const userFilters = new Filter(a, b);
            const user = new User(userId, userFilters, true);

            await hzClient.updateUsersMap(user.toJSON())
        });

        socket.on('disconnect', () => {
            connectedClients.delete(socket.id);
        });
    });
};

main();