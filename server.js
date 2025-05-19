const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Chat rooms storage
const rooms = new Map();

// Connection handler
wss.on('connection', (ws) => {
  let currentRoomId = null;
  let username = null;

  ws.on('message', (message) => {
    const data = JSON.parse(message);
    
    switch (data.type) {
      case 'create_room':
        // Generate a new room ID
        const roomId = uuidv4().substring(0, 8);
        rooms.set(roomId, { 
          users: new Map(), 
          history: [] 
        });
        
        // Send room ID back to creator
        ws.send(JSON.stringify({
          type: 'room_created',
          roomId
        }));
        break;
        
      case 'join_room':
        username = data.username;
        currentRoomId = data.roomId;
        
        // Check if room exists
        if (!rooms.has(currentRoomId)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Room does not exist'
          }));
          return;
        }
        
        // Add user to room
        const room = rooms.get(currentRoomId);
        room.users.set(ws, username);
        
        // Send chat history to new user
        ws.send(JSON.stringify({
          type: 'chat_history',
          history: room.history
        }));
        
        // Notify everyone in the room about the new user
        broadcastToRoom(currentRoomId, {
          type: 'user_joined',
          username,
          timestamp: new Date().toISOString()
        }, ws);
        break;
        
      case 'send_message':
        if (!currentRoomId || !rooms.has(currentRoomId)) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Not in a valid room'
          }));
          return;
        }
        
        // Create message object
        const messageObj = {
          type: 'new_message',
          content: data.content,
          username,
          timestamp: new Date().toISOString()
        };
        
        // Store in history
        rooms.get(currentRoomId).history.push(messageObj);
        
        // Send to all users in the room
        broadcastToRoom(currentRoomId, messageObj);
        break;
    }
  });

  // Handle disconnection
  ws.on('close', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);
      
      // Remove user from room
      if (room.users.has(ws)) {
        const username = room.users.get(ws);
        room.users.delete(ws);
        
        // Notify others about user leaving
        broadcastToRoom(currentRoomId, {
          type: 'user_left',
          username,
          timestamp: new Date().toISOString()
        });
        
        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  });
});

// Broadcast message to all users in a room
function broadcastToRoom(roomId, message, exclude = null) {
  if (!rooms.has(roomId)) return;
  
  const room = rooms.get(roomId);
  room.users.forEach((username, client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});