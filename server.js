const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files (CSS, JS)
app.use(express.static('public'));

// Route to serve the chat page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// Handle new connections
io.on('connection', (socket) => {
  console.log('A user connected');

  // Broadcast chat message to all clients
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  // Handle disconnects
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Start the server on port 3000
server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
