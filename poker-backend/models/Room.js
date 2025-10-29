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
    stage: {
        type: String,
        enum: ['preflop', 'flop', 'turn', 'river', 'showdown'],
        default: 'preflop'
    },
    actionMarkerIndex: {
        type: Number,
        default: 0
    },
    communityCards: {
        type: [String],
        default: []
    },
    canSelectWinner: {
        type: Boolean,
        default: false
    },
    showCards: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);