const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const admin = require('firebase-admin');

dotenv.config();

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: "shora-games",
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

// Check if already initialized to avoid errors
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://shora-games-default-rtdb.firebaseio.com/"
  });
}

const db = admin.database();
const usersRef = db.ref('users');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============ ROOT ROUTE ============
app.get('/', (req, res) => {
    res.json({
        name: 'Shora Games API',
        version: '1.0.0',
        status: 'online',
        message: 'Welcome to Shora Games Backend API',
        endpoints: {
            health: 'GET /api/health',
            register: 'POST /api/auth/register',
            login: 'POST /api/auth/login',
            users: 'GET /api/users'
        }
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'Shora Games API is running!',
        timestamp: new Date().toISOString()
    });
});

// REGISTER endpoint
app.post('/api/auth/register', async (req, res) => {
    const { phone, email, username, password } = req.body;
    
    console.log('📝 Registration attempt:', { phone, email, username });
    
    if (!phone || !email || !username || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    try {
        // Check if user already exists
        const snapshot = await usersRef.once('value');
        let existingUser = false;
        
        snapshot.forEach(child => {
            if (child.val().phone === phone || child.val().email === email) {
                existingUser = true;
            }
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Create new user in Firebase
        const newUserRef = usersRef.push();
        const userId = newUserRef.key;
        
        await newUserRef.set({
            id: userId,
            phone,
            email,
            username,
            password: hashedPassword,
            balance: 0,
            totalWinnings: 0,
            gamesPlayed: 0,
            createdAt: new Date().toISOString()
        });
        
        // Generate JWT token
        const token = jwt.sign(
            { id: userId, phone, email },
            process.env.JWT_SECRET || 'shora_secret_key_2026',
            { expiresIn: '7d' }
        );
        
        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token,
            user: { id: userId, phone, email, username }
        });
        
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// LOGIN endpoint
app.post('/api/auth/login', async (req, res) => {
    const { phone, password } = req.body;
    
    console.log('🔐 Login attempt:', { phone });
    
    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password required' });
    }
    
    try {
        // Find user by phone number
        const snapshot = await usersRef.once('value');
        let foundUser = null;
        let userId = null;
        
        snapshot.forEach(child => {
            if (child.val().phone === phone) {
                foundUser = child.val();
                userId = child.key;
            }
        });
        
        if (!foundUser) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Verify password
        const isValid = await bcrypt.compare(password, foundUser.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate token
        const token = jwt.sign(
            { id: userId, phone, email: foundUser.email },
            process.env.JWT_SECRET || 'shora_secret_key_2026',
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: {
                id: userId,
                phone: foundUser.phone,
                email: foundUser.email,
                username: foundUser.username
            }
        });
        
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all users (for testing)
app.get('/api/users', async (req, res) => {
    try {
        const snapshot = await usersRef.once('value');
        const users = [];
        snapshot.forEach(child => {
            const user = child.val();
            delete user.password; // Remove password from response
            users.push(user);
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Shora Games Backend is running!`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
    console.log(`🧪 Test API: http://localhost:${PORT}/api/health`);
    console.log(`📋 Connected to Firebase Realtime Database`);
});
