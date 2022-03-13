const { spawn } = require('child_process');

const express = require('express');
const app = express();
const { Server } = require("socket.io");

const HzClient = require('./hz-client');
const RabbitConsumer = require('./rabbit-consumer');
const { delay } = require('./utils');

const http = require('http');
const server = http.createServer(app);
const io = new Server(server);

const rabbitAddress = 'amqp://guest:guest@localhost:5672/';
const q = 'msg-q';

const users = new Map();

const initServer = (hzPort, serverPort) => {
    return new Promise(async (resolve) => {
        spawn('./hazelcast-5.1/bin/hz-start', { stdio: 'inherit' });

        await delay(10000);

        const hzClient = new HzClient('localhost', hzPort);

        await hzClient.init();

        const rabbitConsumer = new RabbitConsumer(rabbitAddress, q);

        await rabbitConsumer.init();

        rabbitConsumer.on('msg', (msg) => {
            const parsedMsgContent = Number(msg.content.toString());
            
            hzClient.sendMessageToInstances(parsedMsgContent)

            rabbitConsumer.sendAck(msg);
        });

        hzClient.on('msg', (data) => {
            users.forEach((socket, userId) => {
                if(!socket) {
                    return;
                }

                if(data.userId === userId) {
                    socket.emit('msg', data.message);
                }

            });
        });
        
        app.get('/', (_, res) => {
            res.sendFile(__dirname + '/index.html');
        });

        server.listen(serverPort, () => {
            resolve();
        });

        io.on('connection', async (socket) => {
            users.set(socket.id, socket);
            
            await hzClient.addNewUser({
                userId: socket.id,
                filtersConfigured: false
            });

            socket.on('filters', async (filters) => {
                await hzClient.updateUsersFilter({
                    ...filters,
                    userId: socket.id,
                    filtersConfigured: true
                });
            });

            socket.on('disconnect', async () => {
                users.delete(socket.id);
                await hzClient.removeUserFromList(socket.id);
            });
        });
    });
};

const SOCKET_SERVER = Number(process.env.SOCKET_SERVER);
const HZ_SERVER = Number(process.env.HZ_SERVER);

initServer(HZ_SERVER, SOCKET_SERVER);
