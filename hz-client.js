
const EventEmitter = require('events');
const { Client } = require('hazelcast-client');

module.exports = class HzClient extends EventEmitter {

    constructor() {
        super();

        this.instanceId = null;
        this.hzClientInstance = null;
        
        this.usersListName = 'users';
        this.registrationMapName = 'registrations';
        this.topics = new Map();
    }

    async init() {
        this.hzClientInstance = await Client.newHazelcastClient();

        this.setupMembershipListeners();
    }

    async setInstanceId(members) {
        if(this.instanceId) {
            return;
        }

        for(const member of members) {
            const isMemberRegistered = await this.registerInstance(member.uuid);

            if(isMemberRegistered) {
                return;
            }
        }
    }

    setupMembershipListeners() {
        const membershipListeners = {
            init: async (event) => {
                await this.setInstanceId(event.members);
                await this.updateTopics(event.members);
            },
            memberAdded: async (event) => {
                await this.setInstanceId(event.members);
                await this.updateTopics(event.members);
            },
            memberRemoved: (event) => {
                this.removeInstanceFromUsersList(event.member.uuid);
                this.removeTopic(event.member.uuid);
                this.clearRegistrationMap(event.member.uuid);
            }
        };

        this.hzClientInstance.getCluster().addMembershipListener(membershipListeners);
    }

    async clearRegistrationMap(memberId) {
        const registrationMap = await this.hzClientInstance.getMap(this.registrationMapName);
        const memberIdAsString = memberId.toString();

        await registrationMap.delete(memberIdAsString);
    }

    updateTopics(members) {
        members.forEach((member) => {
            this.addNewTopic(member.uuid);
        });
    }

    async addNewTopic(memberId) {  
        if(!this.instanceId) {
            return;
        }
        
        const topicKey = memberId.toString();

        if(this.topics.get(topicKey)) {
            return;
        }

        const topic = await this.hzClientInstance.getReliableTopic(topicKey);
    
        if(memberId.toString() !== this.instanceId.toString()) {
            this.topics.set(topicKey, {
                topic,
            });

            return;
        }

        const listenerId = topic.addMessageListener((message) => {
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

        const { topic, listenerId } = topicData;

        topic.removeMessageListener(listenerId);
        topic.destroy();
        
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

    async registerInstance(memberId) {
        if(this.instanceId) {
            return true;
        }

        const registrationMap = await this.hzClientInstance.getMap(this.registrationMapName);
        const memberIdAsString = memberId.toString();
        const isMemberKeyLocked = await registrationMap.isLocked(memberIdAsString);

        if(isMemberKeyLocked) {
            return false;
        }

        const value = await registrationMap.get(memberIdAsString);

        if(value) {
            return false; 
        }

        await registrationMap.lock(memberIdAsString);
        await registrationMap.set(memberIdAsString, true);
        await registrationMap.unlock(memberIdAsString);

        this.instanceId = memberId;

        return true;
    }
}
