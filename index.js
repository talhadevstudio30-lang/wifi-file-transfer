const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// Create WebSocket server attached to HTTP server
const wss = new WebSocket.Server({ server });

app.use(cors());
app.use(express.json());

const PORT = 8000;

// Store connected clients
const clients = new Map();

// REST API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// WebSocket connection
wss.on('connection', function connection(ws, req) {
  console.log('Client connected');
  
  // Send welcome message
  ws.send(JSON.stringify({ type: 'welcome', message: 'Connected' }));

  // Handle messages
  ws.on('message', function incoming(data) {
    try {
      const message = JSON.parse(data.toString());
      console.log('Received:', message.type);

      if (message.type === 'register') {
        // Store client
        clients.set(message.deviceId, ws);
        ws.deviceId = message.deviceId;
        ws.deviceName = message.name || 'Unknown';
        
        console.log('Device registered:', message.deviceId, message.name);
        
        // Send confirmation
        ws.send(JSON.stringify({ 
          type: 'registered', 
          deviceId: message.deviceId 
        }));

        // Broadcast updated device list
        broadcastDevices();
      }
      else if (message.type === 'transfer-request') {
        // Forward to receiver
        const receiverWs = clients.get(message.receiverId);
        if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
          receiverWs.send(JSON.stringify(message));
          console.log('Transfer request forwarded');
        }
      }
      else if (message.type === 'transfer-response') {
        // Forward to sender
        const senderWs = clients.get(message.senderId);
        if (senderWs && senderWs.readyState === WebSocket.OPEN) {
          senderWs.send(JSON.stringify(message));
          console.log('Transfer response forwarded');
        }
      }
      else if (message.type === 'signal') {
        // Forward signal
        const receiverWs = clients.get(message.receiverId);
        if (receiverWs && receiverWs.readyState === WebSocket.OPEN) {
          receiverWs.send(JSON.stringify(message));
          console.log('Signal forwarded:', message.signalType);
        }
      }
      else if (message.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  });

  // Handle disconnect
  ws.on('close', function() {
    console.log('Client disconnected');
    if (ws.deviceId) {
      clients.delete(ws.deviceId);
      broadcastDevices();
    }
  });

  // Handle errors
  ws.on('error', function(error) {
    console.error('WebSocket error:', error.message);
  });
});

function broadcastDevices() {
  const devices = [];
  clients.forEach((ws, deviceId) => {
    if (ws.readyState === WebSocket.OPEN) {
      devices.push({
        id: deviceId,
        name: ws.deviceName || 'Unknown',
        online: true
      });
    }
  });

  const message = JSON.stringify({ type: 'devices', devices });
  
  clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log('========================================');
  console.log('QuickSend Server running on port', PORT);
  console.log('WebSocket: ws://localhost:' + PORT);
  console.log('========================================');
});

// Keep server alive
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});