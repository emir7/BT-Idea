const EventEmitter = require('events');
const amqp = require('amqplib/callback_api');

module.exports = class RabbitConsumer extends EventEmitter {

    constructor(address, q) {
        super();

        this.address = address;
        this.q = q;

        this.connection = null;
        this.channel = null;
    }

    async init() {
        try {
            const connection = await this.getConnection();
            
            this.channel = await this.createChannel(connection);
            
            const consumerOptions = {
                noAck: false
            };

            this.channel.consume(this.q, (msg) => {
                this.emit('msg', msg)
            }, consumerOptions);
        } catch (error) {
            console.error(error);
        }
    }

    async getConnection() {
        return new Promise((resolve, reject) => {
            amqp.connect(this.address, (error, connection) => {
                if(error) {
                    return reject(error);
                }

                return resolve(connection)
            });

        });
    }

    async createChannel(connection) {
        return new Promise((resolve, reject) => {
            connection.createChannel((error, channel) => {
                if(error) {
                    return reject(error);
                }

                channel.assertQueue(this.q);
                
                return resolve(channel);
            });
        });
    }

    sendAck(msg) {
        this.channel.ack(msg);
    }
};


