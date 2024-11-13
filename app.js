const express = require('express');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require("socket.io");

const app = express();
const http = require("http").createServer(app);
const io = new Server(http);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = "your_secret_key";  // Replace with a secure secret key

app.use(express.json());
app.use(express.static('public'));

// Paths to JSON files for users and messages
const usersFilePath = './server/data/users.json';
const messagesFilePath = './server/data/messages.json';

// Load data from JSON files
const loadData = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Save data to JSON files
const saveData = (filePath, data) => fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

// Helper function to add a new user
function addUser(username, password, role = "user") {
    const users = loadData(usersFilePath);
    const hashedPassword = bcrypt.hashSync(password, 10);
    const user = { username, password: hashedPassword, role };
    users.push(user);
    saveData(usersFilePath, users);
    return user;
}

// Authentication middleware
function authenticateToken(req, res, next) {
    const token = req.headers['authorization'];
    if (!token) return res.sendStatus(403);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// User Registration
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    const users = loadData(usersFilePath);
    if (users.some(user => user.username === username)) {
        return res.status(400).json({ message: "User already exists" });
    }
    const newUser = addUser(username, password);
    res.json({ message: "User registered successfully", user: newUser });
});

// User Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const users = loadData(usersFilePath);
    const user = users.find(u => u.username === username);
    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET);
        return res.json({ token });
    }
    res.status(400).json({ message: "Invalid credentials" });
});

// Promote to Moderator (host-only action)
app.post('/api/promote', authenticateToken, (req, res) => {
    if (req.user.role !== 'host') return res.status(403).json({ message: "Not authorized" });
    const { username } = req.body;
    const users = loadData(usersFilePath);
    const user = users.find(u => u.username === username);
    if (user) {
        user.role = 'moderator';
        saveData(usersFilePath, users);
        return res.json({ message: `${username} promoted to moderator` });
    }
    res.status(404).json({ message: "User not found" });
});

// WebSocket Chat Setup
io.on('connection', (socket) => {
    console.log("User connected");

    // Send chat history
    const messages = loadData(messagesFilePath);
    socket.emit('chat history', messages);

    // Handle new message
    socket.on('send message', (data) => {
        const messages = loadData(messagesFilePath);
        messages.push(data);
        saveData(messagesFilePath, messages);
        io.emit('receive message', data);
    });

    socket.on('disconnect', () => {
        console.log("User disconnected");
    });
});

// Start server
http.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
