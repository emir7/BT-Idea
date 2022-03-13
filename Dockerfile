FROM node:16

RUN apt-get update && \
    apt-get install -y openjdk-11-jdk ca-certificates-java && \
    apt-get clean && \
    update-ca-certificates -f
ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk-amd64/
RUN export JAVA_HOME

WORKDIR /usr/src/app
COPY package*.json ./
COPY hazelcast-5.1 ./

ENV SOCKET_SERVER=8081
ENV HZ_SERVER=5701

RUN npm install
COPY . .
CMD [ "node", "server.js" ]
