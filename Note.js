const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

// Index to sort by latest notes first
noteSchema.index({ date: -1 });

module.exports = mongoose.model('Note', noteSchema);
