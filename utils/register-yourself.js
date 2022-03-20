const axios = require('axios').default;

module.exports.registerYourself = async (address, discoveryServerAddress) => {
    await axios.post(`http://${discoveryServerAddress}/registration`, {
        address
    });
};