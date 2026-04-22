const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Supabase Initialization with Demo Mode Fallback
const isDemoMode = !process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('YOUR_SUPABASE_URL');
let supabase;
let mockNotes = [];
let mockUsers = [];

if (isDemoMode) {
    console.log('⚠️  RUNNING IN DEMO MODE: Data will not be saved permanently.');
} else {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Serve Frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Auth Middleware
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
            req.user = decoded.id;
            next();
        } catch (error) {
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }
    if (!token) return res.status(401).json({ message: 'Not authorized, no token' });
};

// --- API Endpoints ---

// Auth Routes
app.post('/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (isDemoMode) {
            if (mockUsers.find(u => u.username === username)) return res.status(400).json({ message: 'User already exists' });
            // Simplified hashing for Demo Mode to ensure stability
            const newUser = { id: Math.random().toString(36).substr(2, 9), username, password }; 
            mockUsers.push(newUser);
            const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
            return res.status(201).json({ id: newUser.id, username: newUser.username, token });
        }
        
        const { data: existingUser } = await supabase.from('users').select('*').eq('username', username).single();
        if (existingUser) return res.status(400).json({ message: 'User already exists' });
        const hashedPassword = await bcrypt.hash(password, 10);
        const { data: newUser, error } = await supabase.from('users').insert([{ username, password: hashedPassword }]).select().single();
        if (error) throw error;
        const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
        res.status(201).json({ id: newUser.id, username: newUser.username, token });
    } catch (err) {
        console.error('Registration Error:', err);
        res.status(500).json({ message: err.message });
    }
});

app.post('/auth/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (isDemoMode) {
            const user = mockUsers.find(u => u.username === username);
            // Direct comparison for Demo Mode stability
            if (user && user.password === password) { 
                const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
                return res.json({ id: user.id, username: user.username, token });
            }
            return res.status(401).json({ message: 'Invalid username or password' });
        }

        const { data: user, error } = await supabase.from('users').select('*').eq('username', username).single();
        if (user && (await bcrypt.compare(password, user.password))) {
            const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
            res.json({ id: user.id, username: user.username, token });
        } else {
            res.status(401).json({ message: 'Invalid username or password' });
        }
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// GET /notes - Fetch user notes
app.get('/notes', protect, async (req, res) => {
    try {
        if (isDemoMode) {
            return res.json(mockNotes.filter(n => n.user_id === req.user));
        }
        const { data: notes, error } = await supabase.from('notes').select('*').eq('user_id', req.user).order('date', { ascending: false });
        if (error) throw error;
        res.json(notes);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// POST /add-note - Create a new note
app.post('/add-note', protect, async (req, res) => {
    const { text } = req.body;
    try {
        if (isDemoMode) {
            const newNote = { id: Math.random().toString(36).substr(2, 9), text, user_id: req.user, date: new Date() };
            mockNotes.push(newNote);
            return res.status(201).json(newNote);
        }
        const { data: newNote, error } = await supabase.from('notes').insert([{ text, user_id: req.user }]).select().single();
        if (error) throw error;
        res.status(201).json(newNote);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// DELETE /note/:id - Delete a note by ID
app.delete('/note/:id', protect, async (req, res) => {
    try {
        if (isDemoMode) {
            mockNotes = mockNotes.filter(n => n.id !== req.params.id);
            return res.json({ message: 'Note deleted successfully' });
        }
        const { error } = await supabase.from('notes').delete().eq('id', req.params.id).eq('user_id', req.user);
        if (error) throw error;
        res.json({ message: 'Note deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
