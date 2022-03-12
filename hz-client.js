const EventEmitter = require('events');
const { Client } = require('hazelcast-client');

module.exports = class HzClient extends EventEmitter {

    constructor(ip, port) {
        super();

        this.ip = ip;
        this.port = port;
        this.instanceId = null;
        this.hzClientInstance = null;
        this.usersListName = 'users';
        this.topics = new Map();
    }

    async init() {
        this.hzClientInstance = await Client.newHazelcastClient();

        this.setInstanceId();
        this.setupMembershipListeners();
    }

    setInstanceId() {
        const cluster = this.hzClientInstance.getCluster();
        const members = cluster.getMembers();

        const member = members.find((member) => {
            return member.address.host === this.ip && member.address.port === this.port;
        });

        this.instanceId = member.uuid;
    }

    setupMembershipListeners() {
        const membershipListeners = {
            init: (event) => {
                this.updateTopics(event.members);
            },
            memberAdded: (event) => {
                this.updateTopics(event.members);
            },
            memberRemoved: (event) => {
                this.removeTopic(event.member.uuid);
                this.removeInstanceFromUsersList(event.member.uuid);
            }
        };

        this.hzClientInstance.getCluster().addMembershipListener(membershipListeners);
    }

    updateTopics(members) {
        members.forEach((member) => {
            this.addNewTopic(member.uuid);
        });
    }

    async addNewTopic(memberId) {  
        console.log(memberId);
        console.log(this.instanceId);
        console.log("------")      
        const topicKey = memberId.toString();

        if(this.topics.get(topicKey)) {
            return;
        }

        const topic = await this.hzClientInstance.getReliableTopic(topicKey);
    
        if(memberId.toString() !== this.instanceId.toString()) {
            console.log("adding topic!")
            this.topics.set(topicKey, {
                topic,
            });

            return;
        }

        const listenerId = topic.addMessageListener((message) => {
            console.log(message.messageObject);
            this.emit('msg', message.messageObject);
        });

        this.topics.set(topicKey, {
            topic,
            listenerId
        });
    }

    async removeInstanceFromUsersList(memberId) {
        const usersList = await this.getUsersList();
        const usersListArray = await usersList.toArray();

        const filteredUsersList = usersListArray.filter((user) => {
            return user.instanceId === memberId
        });
        
        await usersList.removeAll(filteredUsersList);
    }

    removeTopic(memberId) {
        const topicKey = memberId.toString();
        const topicData = this.topics.get(topicKey);

        if(!topicData) {
            return;
        }

        const { topic, listenerId } = topicData();

        topic.removeMessageListener(listenerId);

        this.topics.delete(topicKey);
    }

    async addNewUser(newUser) {
        const usersList = await this.getUsersList();

        await usersList.add({
            ...newUser,
            instanceId: this.instanceId.toString()
        });
    }

    async updateUsersFilter(updatedUser) {
        const usersList = await this.getUsersList();
        const usersListArray = await usersList.toArray();

        const userIndex = usersListArray.findIndex((user) => {
            return user.userId === updatedUser.userId;
        });

        if(userIndex < 0) {
            return;
        }

        const currentUserData = usersListArray[userIndex];

        await usersList.set(userIndex, {
            ...currentUserData,
            ...updatedUser
        });
    }

    async sendMessageToInstances(message) {
        const usersList = await this.getUsersList();
        const usersListArray = await usersList.toArray();
        
        usersListArray.forEach((user) => {
            const { a, b, filtersConfigured } = user;

            if(!filtersConfigured) {
                return;
            }

            console.log(message)
            
            if(message >= a && message <= b) {
                const messageForInstance = {
                    userId: user.userId,
                    message
                };

                this.sendMessageToSpecificInstance(user.instanceId, messageForInstance);
            }
        });
    }

    sendMessageToSpecificInstance(instanceId, messageForInstance) {
        const topicData = this.topics.get(instanceId);

        if(!topicData) {
            return;
        }

        topicData.topic.publish(messageForInstance);
    }

    async getUsersList() {
        return this.hzClientInstance.getList(this.usersListName);
    }

    async removeUserFromList(userId) {
        const usersList = await this.getUsersList();
        const usersListArray = await usersList.toArray();

        const userIndex = usersListArray.findIndex((user) => {
            return user.userId === userId;
        });

        if(userIndex < 0) {
            return;
        }

        await usersList.removeAt(userIndex);
    }
}