require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const shortid = require('shortid');

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
        console.error('Server will continue running but MongoDB operations will fail');
    });

const io = new Server(server, {
    cors: {
        origin: [process.env.CORS_ORIGIN || 'http://localhost:3000'], 
        methods: ['GET', 'POST']
    }
});

const socketPlayerMap = new Map();

function getNextTurnIndex(players, currentIndex) {
    if (!players || players.length === 0) return 0;
    let nextIndex = (currentIndex + 1) % players.length;
    let attempts = 0;
    while ((players[nextIndex].folded || players[nextIndex].inactive) && attempts < players.length) {
        nextIndex = (nextIndex + 1) % players.length;
        attempts++;
    }
    return nextIndex;
}

function getActivePlayers(players) {
    return players.filter(p => !p.folded && !p.inactive);
}

function haveAllActivePlayersMatchedMaxBet(players, maxBet) {
    return players.filter(p => !p.folded).every(p => p.currentBet === maxBet);
}

function advanceStage(room) {
    // Advances stage to next and sets up community cards; used when round completes normally
    if (room.stage === 'preflop') {
        room.stage = 'flop';
        while (room.communityCards.length < 3) {
            room.communityCards.push('card');
        }
    } else if (room.stage === 'flop') {
        room.stage = 'turn';
        if (room.communityCards.length < 4) room.communityCards.push('card');
    } else if (room.stage === 'turn') {
        room.stage = 'river';
        if (room.communityCards.length < 5) room.communityCards.push('card');
    } else if (room.stage === 'river') {
        room.stage = 'showdown';
        room.showCards = true;
        room.canSelectWinner = true;
    }

    // Reset current bets and marker for next betting round
    room.players.forEach(p => { p.currentBet = 0; });
    room.maxBet = 0;

    const startFrom = typeof room.actionMarkerIndex === 'number' ? room.actionMarkerIndex : room.currentTurnIndex;
    room.currentTurnIndex = getNextTurnIndex(room.players, startFrom);
    room.actionMarkerIndex = room.currentTurnIndex;
}

/**
 * Resets round state in the room object (server-side) — does NOT save or emit.
 * Use await save + emit after calling this where appropriate.
 */
function performRoundResetInMemory(room) {
    room.players.forEach(player => {
        player.folded = false;
        player.currentBet = 0;
        player.inactive = player.inactive || false; // keep spectators/inactive as-is
    });
    room.pot = 0;
    room.maxBet = 0;
    room.currentTurnIndex = 0;
    room.stage = 'preflop';
    room.actionMarkerIndex = 0;
    room.communityCards = [];
    room.canSelectWinner = false;
    room.showCards = false;
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
                inactive: false,
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

    /**
     * Core action handler: fold / call / raise
     * When only one active player remains after any fold, award pot to them,
     * emit the result, wait 4s (show the winner), then reset the round.
     */
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
                if (isNaN(raiseAmount) || raiseAmount <= room.maxBet) {
                   socket.emit('error:invalid_raise', 'Raise must be a number greater than the current max bet.');
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

                room.actionMarkerIndex = playerIndex;
            }

            // Move to next active player's index
            const nextIndex = getNextTurnIndex(room.players, room.currentTurnIndex);
            room.currentTurnIndex = nextIndex;

            // Count active players (not folded and not inactive)
            const activePlayers = getActivePlayers(room.players);

            // Determine if the round ends (normal flow) or if only one active player left
            let roundEnds = false;
            let singleWinnerId = null;

            if (activePlayers.length <= 1) {
                // Only one player left -> award the pot to them immediately (but show results before reset)
                roundEnds = true;
                const winner = activePlayers[0];
                if (winner) {
                    singleWinnerId = winner._id.toString();
                    // Award pot immediately in-memory
                    winner.balance += room.pot;
                }
                // Set round to showdown so clients can reveal cards
                room.stage = 'showdown';
                room.showCards = true;
                room.canSelectWinner = false; // no manual selection needed in auto-win
            } else {
                // Normal round end detection when everyone matched or action marker cycles
                if (room.maxBet === 0) {
                    if (room.actionMarkerIndex === nextIndex) {
                        roundEnds = true;
                    }
                } else {
                    const everyoneMatched = haveAllActivePlayersMatchedMaxBet(room.players, room.maxBet);
                    if (everyoneMatched && room.actionMarkerIndex === nextIndex) {
                        roundEnds = true;
                    }
                }

                if (roundEnds) {
                    // Progress to next stage if normal flow
                    advanceStage(room);
                }
            }

            // Save room now (after action and possible immediate awarding)
            const updatedRoom = await room.save();

            // Emit the update to clients
            io.to(roomCode).emit('room:update', updatedRoom);

            if (singleWinnerId) {
                // Emit round ended info so frontends can show a "winner" toast/pop-up
                io.to(roomCode).emit('round:ended', { winnerId: singleWinnerId, amountWon: updatedRoom.pot });

                // Wait for a few seconds so clients can display the winner/show cards
                const SHOW_WINNER_MS = 4000; // 4 seconds; change as desired

                setTimeout(async () => {
                    try {
                        // Reload room (to prevent race conditions)
                        const roomToReset = await Room.findOne({ code: roomCode });
                        if (!roomToReset) return;

                        // The pot was already awarded in-memory to winner above, but we must set pot to 0 in DB state
                        roomToReset.pot = 0;
                        // Clear community cards and hide them after the reveal
                        roomToReset.communityCards = [];
                        roomToReset.showCards = false;
                        roomToReset.canSelectWinner = false;
                        roomToReset.stage = 'preflop';
                        // Reset bets/folded flags for active players but keep inactive flags as they are
                        roomToReset.players.forEach(p => {
                            p.folded = false;
                            p.currentBet = 0;
                        });
                        roomToReset.maxBet = 0;

                        // Reset turn index safely
                        roomToReset.currentTurnIndex = 0;
                        roomToReset.actionMarkerIndex = 0;

                        // Persist reset
                        const finalRoom = await roomToReset.save();
                        io.to(roomCode).emit('room:update', finalRoom);
                    } catch (err) {
                        console.error('Error during post-win reset timeout:', err);
                    }
                }, SHOW_WINNER_MS);
            }

        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error processing action.');
        }
    });

    // Manual round reset endpoint (keeps behavior similar to your existing / round:reset)
    socket.on('round:reset', async ({ roomCode }) => {
        try {
            let room = await Room.findOne({ code: roomCode });
            if (!room) return;

            room.showCards = true; // show until reset
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
                    roomToReset.stage = 'preflop';
                    roomToReset.actionMarkerIndex = 0;
                    roomToReset.communityCards = [];
                    roomToReset.canSelectWinner = false;
                    
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

    socket.on('player:leave', async ({ roomCode, mode }) => {
        try {
            const playerId = socketPlayerMap.get(socket.id);
            if (!playerId) {
                socket.emit('error:not_authorized', 'You are not linked to a player.');
                return;
            }

            const room = await Room.findOne({ code: roomCode });
            if (!room) return;

            const idx = room.players.findIndex(p => p._id.toString() === playerId);
            if (idx === -1) {
                socket.emit('error:not_authorized', 'Player not found in this room.');
                return;
            }

            if (mode === 'permanent') {
                const removingBeforeTurn = idx < room.currentTurnIndex;
                const removingIsTurn = idx === room.currentTurnIndex;
                room.players.splice(idx, 1);
                if (room.players.length === 0) {
                    room.currentTurnIndex = 0;
                } else {
                    if (removingBeforeTurn) {
                        room.currentTurnIndex = (room.currentTurnIndex - 1 + room.players.length) % room.players.length;
                    } else if (removingIsTurn) {
                        room.currentTurnIndex = room.currentTurnIndex % room.players.length;
                    }
                }
                if (typeof room.actionMarkerIndex === 'number') {
                    room.actionMarkerIndex = Math.min(room.actionMarkerIndex, Math.max(0, room.players.length - 1));
                }
            } else {
                const p = room.players[idx];
                p.inactive = true;
                p.folded = true;
                if (idx === room.currentTurnIndex) {
                    room.currentTurnIndex = getNextTurnIndex(room.players, room.currentTurnIndex);
                }
            }

            const updatedRoom = await room.save();
            io.to(roomCode).emit('room:update', updatedRoom);
        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error leaving the game.');
        }
    });

    socket.on('player:joinagain', async ({ roomCode }) => {
        try {
            const playerId = socketPlayerMap.get(socket.id);
            if (!playerId) {
                socket.emit('error:not_authorized', 'You are not linked to a player.');
                return;
            }
            const room = await Room.findOne({ code: roomCode });
            if (!room) return;
            const p = room.players.find(p => p._id.toString() === playerId);
            if (!p) {
                socket.emit('error:not_authorized', 'Player not found in this room.');
                return;
            }
            p.inactive = false;
            p.folded = false;
            await room.save();
            io.to(roomCode).emit('room:update', room);
        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error rejoining the game.');
        }
    });
    
    socket.on('round:award', async ({ roomCode, winnerIds }) => {
        try {
            const room = await Room.findOne({ code: roomCode });
            if (!room) return;

            if (!Array.isArray(winnerIds) || winnerIds.length === 0) {
                socket.emit('error:invalid_award', 'No winners provided.');
                return;
            }

            const winners = room.players.filter(p => winnerIds.includes(p._id.toString()));
            if (winners.length === 0) {
                socket.emit('error:invalid_award', 'Winners not found in room.');
                return;
            }

            const totalPot = room.pot;
            const share = Math.floor(totalPot / winners.length);
            const remainder = totalPot % winners.length;

            winners.forEach((p, idx) => {
                p.balance += share + (idx === 0 ? remainder : 0);
            });

            room.pot = 0;
            room.canSelectWinner = false;
            // Clear community cards and hide them after award
            room.communityCards = [];
            room.showCards = false;
            room.stage = 'preflop';

            const updatedRoom = await room.save();
            io.to(roomCode).emit('room:update', updatedRoom);
        } catch (err) {
            console.error(err);
            socket.emit('error:server', 'Error awarding pot.');
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