const { fork } = require('child_process');

const spawnServerInstance = (serverStartPort, instanceNumber) => {
    return new Promise((resolve) => {
        const serverInstance = fork('server.js');    

        serverInstance.send({
            serverPort: serverStartPort + instanceNumber
        });
        
        serverInstance.on('message', () => {
            resolve();
        });

    });
};

const spawnServerInstances = async (index, numberOfInstances, serverStartPort) => {
    if(index === numberOfInstances) {
        return;
    }

    await spawnServerInstance(serverStartPort, index);

    spawnServerInstances(index + 1, numberOfInstances, serverStartPort);
};

spawnServerInstances(0, 10, 8000);
