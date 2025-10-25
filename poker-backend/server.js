const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const shortid = require('shortid');

import cors from "cors";
app.use(cors());

// Import Models
const Room = require('./models/Room');

// --- Basic Setup ---
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);

// --- MongoDB Connection ---
// !! IMPORTANT: Replace with your own MongoDB connection string
const MONGO_URI = 'mongodb://127.0.0.1:27017/poker-manager'; 
mongoose.connect(MONGO_URI)
    .then(() => console.log('MongoDB Connected successfully.'))
    .catch(err => console.error('MongoDB Connection Error:', err));

// --- Socket.IO Setup ---
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000', // Allow your React app
        methods: ['GET', 'POST']
    }
});

// --- In-memory map to link sockets to players ---
// Map<socket.id, Player._id>
const socketPlayerMap = new Map();

// --- Helper: Find next active player ---
function getNextTurnIndex(players, currentIndex) {
    let nextIndex = (currentIndex + 1) % players.length;
    let attempts = 0;
    while (players[nextIndex].folded && attempts < players.length) {
        nextIndex = (nextIndex + 1) % players.length;
        attempts++;
    }
    return nextIndex;
}

// --- Socket.IO Connection Logic ---
io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // --- 1. JOIN ROOM ---
    socket.on('room:join', async ({ roomCode, playerId }) => {
        try {
            const room = await Room.findOne({ code: roomCode });
            if (!room) {
                socket.emit('error:room_not_found', 'Room not found.');
                return;
            }
            
            socket.join(roomCode);
            console.log(`User ${socket.id} joined room ${roomCode}`);

            if (playerId) {
                const playerExists = room.players.some(p => p._id.toString() === playerId);
                if (playerExists) {
                    socketPlayerMap.set(socket.id, playerId);
                    console.log(`Re-linked socket ${socket.id} to player ${playerId}`);
                }
            }
            
            socket.emit('room:update', room);
        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error joining room.');
        }
    });

    // --- 2. ADD PLAYER ---
    socket.on('player:add', async ({ roomCode, playerName, balance }) => {
        try {
            const newPlayer = {
                name: playerName,
                balance: balance,
                folded: false,
                currentBet: 0
            };
            
            const room = await Room.findOne({ code: roomCode });
            if (!room) return;

            room.players.push(newPlayer);
            const updatedRoom = await room.save();

            const createdPlayer = updatedRoom.players[updatedRoom.players.length - 1];
            
            socketPlayerMap.set(socket.id, createdPlayer._id.toString());
            console.log(`Linked socket ${socket.id} to NEW player ${createdPlayer._id}`);

            socket.emit('player:assigned', createdPlayer);
            io.to(roomCode).emit('room:update', updatedRoom);

        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error adding player.');
        }
    });

    // --- 3. PLAYER ACTION ---
    socket.on('player:action', async ({ roomCode, action, amount }) => {
        try {
            const playerId = socketPlayerMap.get(socket.id);
            if (!playerId) {
                socket.emit('error:not_authorized', 'You are not linked to a player.');
                return;
            }

            const room = await Room.findOne({ code: roomCode });
            if (!room) return;

            const playerIndex = room.players.findIndex(p => p._id.toString() === playerId);
            if (playerIndex === -1) {
                 socket.emit('error:not_authorized', 'Player not found in this room.');
                 return;
            }

            if (playerIndex !== room.currentTurnIndex) {
                socket.emit('error:not_your_turn', 'It is not your turn.');
                return;
            }

            let player = room.players[playerIndex];
            let cost = 0;

            if (action === 'fold') {
                player.folded = true;
            } 
            else if (action === 'call') {
                cost = room.maxBet - player.currentBet;
                if (cost > player.balance) cost = player.balance; // All-in

                player.balance -= cost;
                player.currentBet += cost;
                room.pot += cost;
            } 
            else if (action === 'raise') {
                const raiseAmount = Number(amount);
                if (raiseAmount <= room.maxBet) {
                   socket.emit('error:invalid_raise', 'Raise must be higher than the current max bet.');
                   return;
                }
                
                cost = raiseAmount - player.currentBet;
                if (cost > player.balance) {
                    socket.emit('error:insufficient_funds', 'Not enough balance to raise.');
                    return;
                }

                player.balance -= cost;
                player.currentBet += cost;
                room.pot += cost;
                room.maxBet = player.currentBet;
            }

            room.currentTurnIndex = getNextTurnIndex(room.players, room.currentTurnIndex);
            
            const updatedRoom = await room.save();
            io.to(roomCode).emit('room:update', updatedRoom);

        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error processing action.');
        }
    });

    // --- 4. RESET ROUND (Simplified) ---
    socket.on('round:reset', async ({ roomCode }) => {
        try {
            // Step 1: Find room and set flag to show cards
            let room = await Room.findOne({ code: roomCode });
            if (!room) return;

            room.showCards = true; // Just set this to true
            
            let updatedRoom = await room.save();
            io.to(roomCode).emit('room:update', updatedRoom);

            // Step 2: After 5 seconds, actually reset the round
            setTimeout(async () => {
                try {
                    let roomToReset = await Room.findOne({ code: roomCode });
                    if (!roomToReset) return;

                    // Reset player statuses
                    roomToReset.players.forEach(player => {
                        player.folded = false;
                        player.currentBet = 0;
                    });
                    
                    // Reset room state
                    roomToReset.pot = 0;
                    roomToReset.maxBet = 0;
                    roomToReset.currentTurnIndex = 0;
                    
                    // Clear the cards
                    roomToReset.showCards = false;

                    const finalRoom = await roomToReset.save();
                    io.to(roomCode).emit('room:update', finalRoom);
                } catch (err) {
                     console.error('Error during round reset timeout:', err);
                }
            }, 5000); // 5-second delay

        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error resetting round.');
        }
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const playerId = socketPlayerMap.get(socket.id);
        if (playerId) {
            console.log(`Unlinking socket ${socket.id} from player ${playerId}`);
            socketPlayerMap.delete(socket.id);
        }
    });
});


// --- REST API Endpoints ---

app.post('/api/rooms', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) {
            return res.status(400).json({ msg: 'Room name is required.' });
        }
        
        const newRoom = new Room({
            name: name,
            code: shortid.generate().substring(0, 6).toUpperCase(),
            players: [],
            pot: 0,
            maxBet: 0,
            currentTurnIndex: 0
        });

        await newRoom.save();
        res.status(201).json(newRoom);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

app.get('/api/rooms/:code', async (req, res) => {
    try {
        const room = await Room.findOne({ code: req.params.code.toUpperCase() });
        if (!room) {
            return res.status(404).json({ msg: 'Room not found.' });
        }
        res.json(room);
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});


// --- Start Server ---
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));