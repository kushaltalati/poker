const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
    name: {
        type: String,
        required: true
    },
    balance: {
        type: Number,
        default: 1000
    },
    folded: {
        type: Boolean,
        default: false
    },
    // Tracks what the player has bet IN THIS ROUND
    currentBet: {
        type: Number,
        default: 0
    }
});

// We export the schema itself to be used as a sub-document
module.exports = PlayerSchema;