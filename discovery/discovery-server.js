const axios = require('axios').default;
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

const availableServerAddresses = [];
let lastServerIndex = 0;
let isAvailaibilityCheckInProgress = false;

app.use(bodyParser.json());

const checkServerAvailability = async () => {
    if(isAvailaibilityCheckInProgress) {
        return;
    }

    isAvailaibilityCheckInProgress = true;

    for(let i = availableServerAddresses.length - 1; i >= 0; i--) {
        const serverAddress = availableServerAddresses[i];

        try {
            await axios.get(`${serverAddress}/health`, {
                timeout: 100
            });
        } catch {
            availableServerAddresses.splice(i, 1);
        }
    }

    isAvailaibilityCheckInProgress = false;
};

const addToListOfAvailableServer = (address) => {
    const isExistingAddress = availableServerAddresses.some((serverAddress) => serverAddress === address);
   
    if(isExistingAddress) {
        return;
    }

    availableServerAddresses.push(address);
};

const getNextServerAddress = () => {
    return availableServerAddresses[lastServerIndex % availableServerAddresses.length];
};

app.post('/registration', (req, res) => {
    addToListOfAvailableServer(req.body.address);
    
    return res.status(200).send();
});

app.get('/socket-server', (_, res) => {
    res.status(200)
        .send({
            address: getNextServerAddress()
        });
        
    lastServerIndex++;
});


app.listen(5000, () => {
    console.log('Discovery server is up and running on port 5000');

    setInterval(() => {
        checkServerAvailability();
    }, 1000);
});

