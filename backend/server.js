const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// CORS - Allow requests from your frontend
app.use(cors({
    origin: ['https://shora-frontend.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// In-memory storage (data resets when server restarts)
let users = [];

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Shora Games API running!' });
});

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    const { phone, email, username, password } = req.body;
    
    console.log('📝 Registration:', { phone, email, username });
    
    if (!phone || !email || !username || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }
    
    const existingUser = users.find(u => u.phone === phone || u.email === email);
    if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const newUser = {
        id: users.length + 1,
        phone,
        email,
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    const token = jwt.sign(
        { id: newUser.id, phone, email },
        process.env.JWT_SECRET || 'shora_secret_2026',
        { expiresIn: '7d' }
    );
    
    res.status(201).json({
        success: true,
        message: 'Account created!',
        token,
        user: { id: newUser.id, phone, email, username }
    });
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { phone, password } = req.body;
    
    console.log('🔐 Login attempt:', { phone });
    
    if (!phone || !password) {
        return res.status(400).json({ error: 'Phone and password required' });
    }
    
    const user = users.find(u => u.phone === phone);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign(
        { id: user.id, phone, email: user.email },
        process.env.JWT_SECRET || 'shora_secret_2026',
        { expiresIn: '7d' }
    );
    
    res.json({
        success: true,
        message: 'Login successful!',
        token,
        user: { id: user.id, phone: user.phone, email: user.email, username: user.username }
    });
});

// Get all users (testing only)
app.get('/api/users', (req, res) => {
    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json(safeUsers);
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📋 Users in memory: ${users.length}`);
});
