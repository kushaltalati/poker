const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const PlayerSchema = require('./Player'); // Import the sub-document

const RoomSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    code: {
        type: String,
        required: true,
        unique: true
    },
    players: [PlayerSchema], // Array of embedded player documents
    pot: {
        type: Number,
        default: 0
    },
    // The highest bet any player has made this round
    maxBet: {
        type: Number,
        default: 0
    },
    // Index of the player whose turn it is
    currentTurnIndex: {
        type: Number,
        default: 0
    },
    showCards: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);