// const uWS = require('./uws.js');
const uWS = require('../uWebSockets.js-20.30.0/uws');
const Redis = require('ioredis');

const { uuid } = require('uuidv4');
const port = 7777;

const decoder = new TextDecoder('utf-8');

const MESSAGE_ENUM = Object.freeze({
  SELF_CONNECTED: "SELF_CONNECTED",
  CLIENT_CONNECTED: "CLIENT_CONNECTED",
  CLIENT_DISCONNECTED: "CLIENT_DISCONNECTED",
  CLIENT_MESSAGE: "CLIENT_MESSAGE",
  GROUP_MESSAGE: "GROUP_MESSAGE",
  CREATE_GROUP: "CREATE_GROUP",
  JOIN_GROUP: "JOIN_GROUP",
  LEAVE_GROUP: "LEAVE_GROUP",
  GROUP_LIST: "GROUP_LIST",
  USER_LIST: "USER_LIST",
  IMAGE_MESSAGE: "IMAGE_MESSAGE",
  GROUP_IMAGE_MESSAGE: "GROUP_IMAGE_MESSAGE",
  TYPING_STARTED: "TYPING_STARTED",
  TYPING_STOPPED: "TYPING_STOPPED",
  GROUP_TYPING_STARTED: "GROUP_TYPING_STARTED",
  GROUP_TYPING_STOPPED: "GROUP_TYPING_STOPPED",
  REPLY_MESSAGE: "REPLY_MESSAGE",
  GROUP_REPLY_MESSAGE: "GROUP_REPLY_MESSAGE",
  PRIVATE_MESSAGE: "PRIVATE_MESSAGE",
  PRIVATE_IMAGE_MESSAGE: "PRIVATE_IMAGE_MESSAGE",
  PRIVATE_TYPING_STARTED: "PRIVATE_TYPING_STARTED",
  PRIVATE_TYPING_STOPPED: "PRIVATE_TYPING_STOPPED",
  PRIVATE_REPLY_MESSAGE: "PRIVATE_REPLY_MESSAGE",
  PING: "PING"
})

let sockets = [];
let groups = new Map(); // Map of groupId -> Set of socket IDs
let userGroups = new Map(); // Map of socketId -> Set of groupIds

// Initialize Redis client
const redis = new Redis({
  host: 'localhost',
  port: 6379
});

// Redis keys
const REDIS_KEYS = {
  CONNECTED_USERS: 'connected_users',
  USER_SOCKET: 'user_socket:',
  SOCKET_USER: 'socket_user:'
};

// Handle Redis errors
redis.on('error', (err) => {
  console.error('Redis error:', err);
});

// const app = uWS.SSLApp({
//   key_file_name: "/etc/letsencrypt/live/your-domain/privkey.pem",
//   cert_file_name: "/etc/letsencrypt/live/your-domain/cert.pem"
// })
const app = uWS.App()
  .ws('/ws', {
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 60,

    open: (ws, req) => {
      console.log('WS open', ws)
      ws.id = uuid();
      ws.username = createName(getRandomInt());

      // subscribe to topics
      ws.subscribe(MESSAGE_ENUM.CLIENT_CONNECTED);
      ws.subscribe(MESSAGE_ENUM.CLIENT_DISCONNECTED);
      ws.subscribe(MESSAGE_ENUM.CLIENT_MESSAGE);
      ws.subscribe(MESSAGE_ENUM.IMAGE_MESSAGE);
      ws.subscribe(MESSAGE_ENUM.TYPING_STARTED);
      ws.subscribe(MESSAGE_ENUM.TYPING_STOPPED);
      ws.subscribe(ws.id); // Subscribe to private messages

      sockets.push(ws);

      // SELF_CONNECTED sent to self only ONCE upon ws open
      let selfMsg = {
        type: MESSAGE_ENUM.SELF_CONNECTED,
        body: {
          id: ws.id,
          name: ws.username
        }
      }
    
      let pubMsg = {
        type: MESSAGE_ENUM.CLIENT_CONNECTED,
        body: {
          id: ws.id,
          name: ws?.username 
        }
      }

      // send to connecting socket only
      ws.send(JSON.stringify(selfMsg));

      // send to *all* subscribed sockets
      app.publish(MESSAGE_ENUM.CLIENT_CONNECTED, JSON.stringify(pubMsg));

      // Send current user list
      const userList = sockets.map(socket => ({
        id: socket.id,
        name: socket.username
      }));

      serverMsg = {
        type: MESSAGE_ENUM.USER_LIST,
        users: userList
      };

      app.publish(MESSAGE_ENUM.USER_LIST, JSON.stringify(serverMsg));
    },

    message: (ws, message, isBinary) => {
      let clientMsg = JSON.parse(decoder.decode(message));
      let serverMsg = {};

      switch (clientMsg.type) {
        case MESSAGE_ENUM.USER_LIST:
          // Send current user list to the requesting client
          const userList = sockets.map(socket => ({
            id: socket.id,
            name: socket.username
          }));

          serverMsg = {
            type: MESSAGE_ENUM.USER_LIST,
            users: userList
          };

          ws.send(JSON.stringify(serverMsg));
          break;

        case MESSAGE_ENUM.CLIENT_MESSAGE:
          serverMsg = {
            type: MESSAGE_ENUM.CLIENT_MESSAGE,
            sender: ws.username,
            body: clientMsg.body
          };
          app.publish(MESSAGE_ENUM.CLIENT_MESSAGE, JSON.stringify(serverMsg));
          break;

        case MESSAGE_ENUM.GROUP_MESSAGE:
          const groupId = clientMsg.groupId;
          if (groups.has(groupId) && groups.get(groupId).has(ws.id)) {
            serverMsg = {
              type: MESSAGE_ENUM.GROUP_MESSAGE,
              sender: ws.username,
              groupId: groupId,
              body: clientMsg.body
            };
            app.publish(groupId, JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.IMAGE_MESSAGE:
          serverMsg = {
            type: MESSAGE_ENUM.IMAGE_MESSAGE,
            sender: ws.username,
            imageData: clientMsg.imageData,
            imageType: clientMsg.imageType
          };
          app.publish(MESSAGE_ENUM.IMAGE_MESSAGE, JSON.stringify(serverMsg));
          break;

        case MESSAGE_ENUM.GROUP_IMAGE_MESSAGE:
          const imageGroupId = clientMsg.groupId;
          if (groups.has(imageGroupId) && groups.get(imageGroupId).has(ws.id)) {
            serverMsg = {
              type: MESSAGE_ENUM.GROUP_IMAGE_MESSAGE,
              sender: ws.username,
              groupId: imageGroupId,
              imageData: clientMsg.imageData,
              imageType: clientMsg.imageType
            };
            app.publish(imageGroupId, JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.CREATE_GROUP:
          const newGroupId = uuid();
          groups.set(newGroupId, new Set([ws.id]));
          userGroups.set(ws.id, new Set([newGroupId]));
          ws.subscribe(newGroupId);
          
          serverMsg = {
            type: MESSAGE_ENUM.GROUP_LIST,
            groups: Array.from(groups.keys()).map(id => ({
              id: id,
              members: Array.from(groups.get(id)).map(socketId => 
                sockets.find(s => s.id === socketId)?.username
              ).filter(Boolean)
            }))
          };
          app.publish(MESSAGE_ENUM.GROUP_LIST, JSON.stringify(serverMsg));
          break;

        case MESSAGE_ENUM.JOIN_GROUP:
          const joinGroupId = clientMsg.groupId;
          if (groups.has(joinGroupId)) {
            groups.get(joinGroupId).add(ws.id);
            if (!userGroups.has(ws.id)) {
              userGroups.set(ws.id, new Set());
            }
            userGroups.get(ws.id).add(joinGroupId);
            ws.subscribe(joinGroupId);
            
            serverMsg = {
              type: MESSAGE_ENUM.GROUP_LIST,
              groups: Array.from(groups.keys()).map(id => ({
                id: id,
                members: Array.from(groups.get(id)).map(socketId => 
                  sockets.find(s => s.id === socketId)?.username
                ).filter(Boolean)
              }))
            };
            app.publish(MESSAGE_ENUM.GROUP_LIST, JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.LEAVE_GROUP:
          const leaveGroupId = clientMsg.groupId;
          if (groups.has(leaveGroupId)) {
            groups.get(leaveGroupId).delete(ws.id);
            if (userGroups.has(ws.id)) {
              userGroups.get(ws.id).delete(leaveGroupId);
            }
            ws.unsubscribe(leaveGroupId);
            
            serverMsg = {
              type: MESSAGE_ENUM.GROUP_LIST,
              groups: Array.from(groups.keys()).map(id => ({
                id: id,
                members: Array.from(groups.get(id)).map(socketId => 
                  sockets.find(s => s.id === socketId)?.username
                ).filter(Boolean)
              }))
            };
            app.publish(MESSAGE_ENUM.GROUP_LIST, JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.TYPING_STARTED:
          serverMsg = {
            type: MESSAGE_ENUM.TYPING_STARTED,
            sender: ws.username
          };
          app.publish(MESSAGE_ENUM.TYPING_STARTED, JSON.stringify(serverMsg));
          break;

        case MESSAGE_ENUM.TYPING_STOPPED:
          serverMsg = {
            type: MESSAGE_ENUM.TYPING_STOPPED,
            sender: ws.username
          };
          app.publish(MESSAGE_ENUM.TYPING_STOPPED, JSON.stringify(serverMsg));
          break;

        case MESSAGE_ENUM.GROUP_TYPING_STARTED:
          const typingGroupId = clientMsg.groupId;
          if (groups.has(typingGroupId) && groups.get(typingGroupId).has(ws.id)) {
            serverMsg = {
              type: MESSAGE_ENUM.GROUP_TYPING_STARTED,
              sender: ws.username,
              groupId: typingGroupId
            };
            app.publish(typingGroupId, JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.GROUP_TYPING_STOPPED:
          const stopTypingGroupId = clientMsg.groupId;
          if (groups.has(stopTypingGroupId) && groups.get(stopTypingGroupId).has(ws.id)) {
            serverMsg = {
              type: MESSAGE_ENUM.GROUP_TYPING_STOPPED,
              sender: ws.username,
              groupId: stopTypingGroupId
            };
            app.publish(stopTypingGroupId, JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.REPLY_MESSAGE:
          serverMsg = {
            type: MESSAGE_ENUM.REPLY_MESSAGE,
            sender: ws.username,
            body: clientMsg.body,
            replyTo: {
              sender: clientMsg.replyTo.sender,
              body: clientMsg.replyTo.body,
              messageType: clientMsg.replyTo.messageType
            }
          };
          app.publish(MESSAGE_ENUM.REPLY_MESSAGE, JSON.stringify(serverMsg));
          break;

        case MESSAGE_ENUM.GROUP_REPLY_MESSAGE:
          const replyGroupId = clientMsg.groupId;
          if (groups.has(replyGroupId) && groups.get(replyGroupId).has(ws.id)) {
            serverMsg = {
              type: MESSAGE_ENUM.GROUP_REPLY_MESSAGE,
              sender: ws.username,
              groupId: replyGroupId,
              body: clientMsg.body,
              replyTo: {
                sender: clientMsg.replyTo.sender,
                body: clientMsg.replyTo.body,
                messageType: clientMsg.replyTo.messageType
              }
            };
            app.publish(replyGroupId, JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.PRIVATE_MESSAGE:
          const targetSocket = sockets.find(s => s.id === clientMsg.recipientId);
          if (targetSocket) {
            serverMsg = {
              type: MESSAGE_ENUM.PRIVATE_MESSAGE,
              sender: ws.username,
              senderId: ws.id,
              recipientId: clientMsg.recipientId,
              body: clientMsg.body
            };
            // Send to recipient
            targetSocket.send(JSON.stringify(serverMsg));
            // Send back to sender
            ws.send(JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.PRIVATE_IMAGE_MESSAGE:
          const imageTargetSocket = sockets.find(s => s.id === clientMsg.recipientId);
          if (imageTargetSocket) {
            serverMsg = {
              type: MESSAGE_ENUM.PRIVATE_IMAGE_MESSAGE,
              sender: ws.username,
              senderId: ws.id,
              recipientId: clientMsg.recipientId,
              imageData: clientMsg.imageData,
              imageType: clientMsg.imageType
            };
            // Send to recipient
            imageTargetSocket.send(JSON.stringify(serverMsg));
            // Send back to sender
            ws.send(JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.PRIVATE_TYPING_STARTED:
          const typingTargetSocket = sockets.find(s => s.id === clientMsg.recipientId);
          if (typingTargetSocket) {
            serverMsg = {
              type: MESSAGE_ENUM.PRIVATE_TYPING_STARTED,
              sender: ws.username,
              senderId: ws.id,
              recipientId: clientMsg.recipientId
            };
            typingTargetSocket.send(JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.PRIVATE_TYPING_STOPPED:
          const stopTypingTargetSocket = sockets.find(s => s.id === clientMsg.recipientId);
          if (stopTypingTargetSocket) {
            serverMsg = {
              type: MESSAGE_ENUM.PRIVATE_TYPING_STOPPED,
              sender: ws.username,
              senderId: ws.id,
              recipientId: clientMsg.recipientId
            };
            stopTypingTargetSocket.send(JSON.stringify(serverMsg));
          }
          break;

        case MESSAGE_ENUM.PRIVATE_REPLY_MESSAGE:
          const replyTargetSocket = sockets.find(s => s.id === clientMsg.recipientId);
          if (replyTargetSocket) {
            serverMsg = {
              type: MESSAGE_ENUM.PRIVATE_REPLY_MESSAGE,
              sender: ws.username,
              senderId: ws.id,
              recipientId: clientMsg.recipientId,
              body: clientMsg.body,
              replyTo: clientMsg.replyTo
            };
            // Send to recipient
            replyTargetSocket.send(JSON.stringify(serverMsg));
            // Send back to sender
            ws.send(JSON.stringify(serverMsg));
          }
          break;

        default:
          console.log("Unknown message type.");
      }
    },

    close: (ws, code, message) => {
      console.log('Close', code)
      // Remove from all groups
      if (userGroups.has(ws.id)) {
        userGroups.get(ws.id).forEach(groupId => {
          if (groups.has(groupId)) {
            groups.get(groupId).delete(ws.id);
          }
        });
        userGroups.delete(ws.id);
      }

      // Remove from sockets array
      sockets.find((socket, index) => {
        if (socket && socket.id === ws.id) {
          sockets.splice(index, 1);
        }
      });
    
      let pubMsg = {
        type: MESSAGE_ENUM.CLIENT_DISCONNECTED,
        body: {
          id: ws.id,
          name: ws.username
        }
      }
    
      app.publish(MESSAGE_ENUM.CLIENT_DISCONNECTED, JSON.stringify(pubMsg));
    }
  }).listen(port, token => {
    console.log('Token', token)
    token ?
    console.log(`Listening to port ${port}`) :
    console.log(`Failed to listen to port ${port}`);
  });

function getRandomInt() {
  return Math.floor(Math.random() * Math.floor(9999));
}

function createName(randomInt) {
  return sockets.find(ws => ws.name === `user-${randomInt}`) ? 
  createName(getRandomInt()) : 
  `user-${randomInt}`
}

function sendUserList(ws) {
  const userList = sockets.map(socket => ({
    id: socket.id,
    name: socket.username
  }));

  const msg = {
    type: MESSAGE_ENUM.USER_LIST,
    users: userList
  };

  ws.send(JSON.stringify(msg));
}

function sendGroupList(ws) {
  const groupList = Array.from(groups.keys()).map(id => ({
    id: id,
    members: Array.from(groups.get(id)).map(socketId => 
      sockets.find(s => s.id === socketId)?.username
    ).filter(Boolean)
  }));

  const msg = {
    type: MESSAGE_ENUM.GROUP_LIST,
    groups: groupList
  };

  ws.send(JSON.stringify(msg));
}

// Helper functions for Redis operations
async function addConnectedUser(userId, userName, socketId) {
  const userData = JSON.stringify({ id: userId, name: userName });
  await redis.hset(REDIS_KEYS.CONNECTED_USERS, userId, userData);
  await redis.set(REDIS_KEYS.USER_SOCKET + userId, socketId);
  await redis.set(REDIS_KEYS.SOCKET_USER + socketId, userId);
}

async function removeConnectedUser(userId, socketId) {
  await redis.hdel(REDIS_KEYS.CONNECTED_USERS, userId);
  await redis.del(REDIS_KEYS.USER_SOCKET + userId);
  await redis.del(REDIS_KEYS.SOCKET_USER + socketId);
}

async function getConnectedUsers() {
  const users = await redis.hgetall(REDIS_KEYS.CONNECTED_USERS);
  return Object.values(users).map(user => JSON.parse(user));
}

async function getUserBySocketId(socketId) {
  const userId = await redis.get(REDIS_KEYS.SOCKET_USER + socketId);
  if (userId) {
    const userData = await redis.hget(REDIS_KEYS.CONNECTED_USERS, userId);
    return userData ? JSON.parse(userData) : null;
  }
  return null;
}
