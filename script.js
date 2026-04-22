// --- Configuration ---
const API_URL = window.location.origin;

// --- State ---
let isRecording = false;
let recognition = null;
let allNotes = [];
let user = JSON.parse(localStorage.getItem('user')) || null;
let isLoginMode = true;

// --- DOM Elements ---
const recordBtn = document.getElementById('record-btn');
const saveBtn = document.getElementById('save-btn');
const noteTextarea = document.getElementById('note-textarea');
const statusText = document.getElementById('status-text');
const notesGrid = document.getElementById('notes-grid');
const themeToggle = document.getElementById('theme-toggle');
const searchInput = document.getElementById('search-input');
const notification = document.getElementById('notification');

const authOverlay = document.getElementById('auth-overlay');
const authForm = document.getElementById('auth-form');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const toggleAuth = document.getElementById('toggle-auth');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authUsernameInput = document.getElementById('auth-username');
const authPasswordInput = document.getElementById('auth-password');

const userProfile = document.getElementById('user-profile');
const usernameDisplay = document.getElementById('username-display');
const logoutBtn = document.getElementById('logout-btn');
const mainContent = document.getElementById('main-content');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initSpeechRecognition();
    checkAuth();
    setupEventListeners();
});

function checkAuth() {
    if (user && user.token) {
        authOverlay.classList.add('hidden');
        mainContent.classList.remove('hidden');
        userProfile.classList.remove('hidden');
        usernameDisplay.textContent = user.username;
        fetchNotes();
    } else {
        authOverlay.classList.remove('hidden');
        mainContent.classList.add('hidden');
        userProfile.classList.add('hidden');
    }
}

// --- Speech Recognition Setup ---
function initSpeechRecognition() {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!window.SpeechRecognition) {
        showNotification('Speech Recognition not supported in this browser.', 'error');
        recordBtn.disabled = true;
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isRecording = true;
        recordBtn.innerHTML = '<i class="fas fa-stop"></i> <span>Stop Recording</span>';
        recordBtn.classList.replace('btn-primary', 'btn-danger');
        statusText.textContent = 'Listening...';
        statusText.classList.add('recording');
    };

    recognition.onend = () => {
        isRecording = false;
        recordBtn.innerHTML = '<i class="fas fa-microphone"></i> <span>Start Recording</span>';
        recordBtn.classList.replace('btn-danger', 'btn-primary');
        statusText.textContent = 'Ready to record';
        statusText.classList.remove('recording');
    };

    recognition.onresult = (event) => {
        let transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join(' ');

        noteTextarea.value = transcript;
        saveBtn.disabled = transcript.trim().length === 0;
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        showNotification(`Error: ${event.error}`, 'error');
    };
}

// --- API Calls ---

async function fetchNotes() {
    if (!user || !user.token) return;
    try {
        const response = await fetch(`${API_URL}/notes`, {
            headers: { 'Authorization': `Bearer ${user.token}` }
        });
        if (response.status === 401) return logout();
        allNotes = await response.json();
        renderNotes(allNotes);
    } catch (err) {
        console.error('Failed to fetch notes:', err);
        showNotification('Failed to load notes from server.', 'error');
    }
}

async function saveNote() {
    const text = noteTextarea.value.trim();
    if (!text || !user) return;

    try {
        const response = await fetch(`${API_URL}/add-note`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${user.token}`
            },
            body: JSON.stringify({ text })
        });

        if (response.status === 401) return logout();

        if (response.ok) {
            noteTextarea.value = '';
            saveBtn.disabled = true;
            showNotification('Note saved successfully!');
            fetchNotes();
        }
    } catch (err) {
        console.error('Failed to save note:', err);
        showNotification('Failed to save note.', 'error');
    }
}

async function deleteNote(id) {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
        const response = await fetch(`${API_URL}/note/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${user.token}` }
        });

        if (response.status === 401) return logout();

        if (response.ok) {
            showNotification('Note deleted.');
            fetchNotes();
        }
    } catch (err) {
        console.error('Failed to delete note:', err);
        showNotification('Failed to delete note.', 'error');
    }
}

async function handleAuth(e) {
    e.preventDefault();
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value.trim();
    
    const endpoint = isLoginMode ? '/auth/login' : '/auth/register';
    
    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            user = data;
            localStorage.setItem('user', JSON.stringify(user));
            authUsernameInput.value = '';
            authPasswordInput.value = '';
            checkAuth();
            showNotification(isLoginMode ? `Welcome back, ${user.username}!` : 'Account created successfully!');
        } else {
            showNotification(data.message || 'Authentication failed', 'error');
        }
    } catch (err) {
        showNotification('Server connection failed', 'error');
    }
}

function logout() {
    user = null;
    localStorage.removeItem('user');
    checkAuth();
    showNotification('Logged out successfully');
}

// --- UI Logic ---

function renderNotes(notes) {
    notesGrid.innerHTML = notes.map(note => `
        <div class="note-card">
            <div class="note-content">${note.text}</div>
            <div class="note-footer">
                <div class="note-date">${new Date(note.date).toLocaleString()}</div>
                <div class="note-actions">
                    <button class="action-btn play-btn" onclick="playNote('${note.text.replace(/'/g, "\\'")}')" title="Play Voice">
                        <i class="fas fa-play"></i>
                    </button>
                    <button class="action-btn delete-btn" onclick="deleteNote('${note._id}')" title="Delete Note">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function playNote(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
}

function showNotification(message, type = 'success') {
    notification.textContent = message;
    notification.className = `notification show ${type}`;
    setTimeout(() => notification.classList.remove('show'), 3000);
}

// --- Event Listeners ---

function setupEventListeners() {
    recordBtn.addEventListener('click', () => {
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

    saveBtn.addEventListener('click', saveNote);

    authForm.addEventListener('submit', handleAuth);
    logoutBtn.addEventListener('click', logout);
    
    toggleAuth.addEventListener('click', (e) => {
        e.preventDefault();
        isLoginMode = !isLoginMode;
        authTitle.textContent = isLoginMode ? 'Welcome Back' : 'Create Account';
        authSubtitle.textContent = isLoginMode ? 'Login to access your voice notes' : 'Join us to start saving your voice notes';
        authSubmitBtn.textContent = isLoginMode ? 'Login' : 'Sign Up';
        toggleAuth.textContent = isLoginMode ? 'Sign Up' : 'Login';
    });

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-mode');
        const isLight = document.body.classList.contains('light-mode');
        themeToggle.innerHTML = isLight ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    });

    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        const filtered = allNotes.filter(note => note.text.toLowerCase().includes(query));
        renderNotes(filtered);
    });

    // Enable save button on manual typing
    noteTextarea.addEventListener('input', () => {
        saveBtn.disabled = noteTextarea.value.trim().length === 0;
    });
}
