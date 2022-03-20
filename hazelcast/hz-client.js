const EventEmitter = require('events');
const { Client } = require('hazelcast-client');

const HZMessage = require('../models/hz-message');

module.exports = class HZClient extends EventEmitter {

    constructor(HZ_PORT) {
        super();

        this.instanceId = null;
        this.hzClientInstance = null;

        this.usersMapName = 'users';

        this.topics = new Map();

        this.HZ_PORT = HZ_PORT;
    }

    async init() {
        this.hzClientInstance = await Client.newHazelcastClient({
            network: {
                clusterMembers: [`localhost:${this.HZ_PORT}`]
            }
        });

        this.setMembershipListeners();
    }

    setMembershipListeners() {
        const membershipListeners = {
            init: (event) => {
                this.setInstanceId(event.members);
                this.setTopics(event.members);
            },
            memberAdded: (event) => {
                this.setTopics(event.members);
            },
            memberRemoved: (event) => {
                const memberId = event.member.uuid.toString();
                
                this.removeUsers(memberId);
                this.removeTopic(memberId);
            }
        };

        this.hzClientInstance.getCluster().addMembershipListener(membershipListeners);
    }

    setInstanceId(members) {
        const connectedMember = members.find((member) => {
            return member.address.port == this.HZ_PORT;
        });

        this.instanceId = connectedMember.uuid.toString();
    }

    setTopics(members) {
        members.forEach((member) => {
            const memberId = member.uuid.toString();

            this.setTopic(memberId);
        });
    }

    async setTopic(memberId) {
        const currentTopicData = this.topics.get(memberId);

        if(currentTopicData) {
            return;
        }

        const topic = await this.hzClientInstance.getReliableTopic(memberId);

        if(memberId !== this.instanceId) {
            this.topics.set(memberId, {
                topic
            });

            return;
        }

        const listenerId = topic.addMessageListener((data) => {
            this.emit('msg', data.messageObject);
        });

        this.topics.set(memberId, {
            topic,
            listenerId
        });
    }

    forwardMessage(message) {
        const topicData = this.topics.get(message.instanceId);

        if(!topicData) {
            return;
        }

        topicData.topic.publish(message.toJSON());
    }

    removeTopic(memberId) {
        const currentTopicData = this.topics.get(memberId);

        if(!currentTopicData) {
            return;
        }

        const { topic, listenerId } = currentTopicData;

        topic.removeMessageListener(listenerId);
        topic.destroy();

        this.topics.delete(memberId);
    }

    async removeUsers(memberId) {
        const usersMap = await this.getUsersMap();
        
        usersMap.delete(memberId);
    }

    async filterUsersAndForwardMessage(message) {
        const usersMap = await this.getUsersMap();
        const usersData = await usersMap.entrySet();

        usersData.forEach(([instanceId, userMap]) => {
            Object.keys(userMap).forEach((userId) => {
                const user = userMap[userId];

                if(!user.areFiltersConfigured) {
                    return;
                }

                const {a, b} = user.filters;

                if(message >= a && message <= b) {
                    const hzMessage = new HZMessage(user.id, message, instanceId);

                    this.forwardMessage(hzMessage);
                }
            });
        });
    }

    async updateUsersMap(user) {
        // TODO: OTPIMIZE WITH EntryProcessor 
        const usersMap = await this.getUsersMap();
        const currentUsers = await usersMap.get(this.instanceId) ?? {}
       
        currentUsers[user.id] = user;
        await usersMap.put(this.instanceId, currentUsers);
    }

    async getUsersMap() {
        return this.hzClientInstance.getMap(this.usersMapName);
    }
}