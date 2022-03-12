const amqp = require('amqplib/callback_api');
const rabbitAddress = 'amqp://guest:guest@localhost:5672/';

amqp.connect(rabbitAddress, (connectionError, connection) =>{
    if(connectionError) {
        console.error('RabbitMQ connection error');
        console.error(connectionError);

        return;
    }

    connection.createChannel((channelError, channel) => {
        if(channelError) {
            console.error('RabbitMQ channel error');
            console.error(channelError);
    
            return;
        }

        setInterval(() => {
            const q = 'msg-q';
            const msg = String(Math.floor(Math.random() * 1000));

            channel.assertQueue(q);
            channel.sendToQueue(q, Buffer.from(msg));
            console.log(`Sent: ${msg}`);
        }, 1000);

    });
});