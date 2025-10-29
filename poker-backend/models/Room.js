const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const PlayerSchema = require('./Player');

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
    players: [PlayerSchema],
    pot: {
        type: Number,
        default: 0
    },
    maxBet: {
        type: Number,
        default: 0
    },
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