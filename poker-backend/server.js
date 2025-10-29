require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const shortid = require('shortid');

// Configure Mongoose to use Promises and enable debug mode
mongoose.set('debug', true);

const Room = require('./models/Room');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/poker-manager'; 
console.log('Attempting to connect to MongoDB...', { uri: MONGO_URI.replace(/mongodb\+srv:\/\/([^:]+):([^@]+)@/, 'mongodb+srv://[hidden]:[hidden]@') });

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('MongoDB Connected successfully.');
        // Test the connection by making a simple query
        return mongoose.connection.db.admin().ping();
    })
    .then(() => {
        console.log('MongoDB connection is healthy - ping successful');
    })
    .catch(err => {
        console.error('MongoDB Connection Error:', {
            error: err.message,
            code: err.code,
            name: err.name,
            stack: err.stack
        });
        // Don't exit the process, but log the error
        console.error('Server will continue running but MongoDB operations will fail');
    });

const io = new Server(server, {
    cors: {
        origin: [process.env.CORS_ORIGIN || 'http://localhost:3000'], 
        methods: ['GET', 'POST']
    }
});

// socket->player
const socketPlayerMap = new Map();

function getNextTurnIndex(players, currentIndex) {
    let nextIndex = (currentIndex + 1) % players.length;
    let attempts = 0;
    while (players[nextIndex].folded && attempts < players.length) {
        nextIndex = (nextIndex + 1) % players.length;
        attempts++;
    }
    return nextIndex;
}

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

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
                if (cost > player.balance) cost = player.balance; // allin

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

    socket.on('round:reset', async ({ roomCode }) => {
        try {
            let room = await Room.findOne({ code: roomCode });
            if (!room) return;

            room.showCards = true;
            
            let updatedRoom = await room.save();
            io.to(roomCode).emit('room:update', updatedRoom);

            setTimeout(async () => {
                try {
                    let roomToReset = await Room.findOne({ code: roomCode });
                    if (!roomToReset) return;

                    roomToReset.players.forEach(player => {
                        player.folded = false;
                        player.currentBet = 0;
                    });
                    
                    roomToReset.pot = 0;
                    roomToReset.maxBet = 0;
                    roomToReset.currentTurnIndex = 0;
                    
                    roomToReset.showCards = false;

                    const finalRoom = await roomToReset.save();
                    io.to(roomCode).emit('room:update', finalRoom);
                } catch (err) {
                     console.error('Error during round reset timeout:', err);
                }
            }, 5000);

        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error resetting round.');
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        const playerId = socketPlayerMap.get(socket.id);
        if (playerId) {
            console.log(`Unlinking socket ${socket.id} from player ${playerId}`);
            socketPlayerMap.delete(socket.id);
        }
    });
});



app.post('/api/rooms', async (req, res) => {
    try {
        const { name } = req.body;
        console.log('Received request to create room:', { name });
        
        if (!name) {
            console.log('Room creation failed: name is required');
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

        console.log('Attempting to save room:', { name, code: newRoom.code });
        const savedRoom = await newRoom.save();
        console.log('Room created successfully:', { id: savedRoom._id, code: savedRoom.code });
        res.status(201).json(savedRoom);
    } catch (err) {
        console.error('Error creating room:', {
            error: err.message,
            stack: err.stack,
            name: err.name
        });
        res.status(500).json({ 
            error: 'Server Error', 
            details: err.message,
            type: err.name 
        });
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


const PORT = process.env.PORT || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));