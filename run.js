const { fork } = require('child_process');

const spawnServerInstance = (serverStartPort, hzMemberSartPort, instanceNumber) => {
    return new Promise((resolve) => {
        const serverInstance = fork('server.js');    

        serverInstance.send({
            hzPort: hzMemberSartPort + instanceNumber,
            serverPort: serverStartPort + instanceNumber
        });
        
        serverInstance.on('message', () => {
            resolve();
        });

    });
};

const spawnServerInstances = async (index, numberOfInstances, serverStartPort, hzMemberSartPort) => {
    if(index === numberOfInstances) {
        return;
    }

    await spawnServerInstance(serverStartPort, hzMemberSartPort, index);

    spawnServerInstances(index + 1, numberOfInstances, serverStartPort, hzMemberSartPort);
};

spawnServerInstances(0, 2, 8000, 5701);