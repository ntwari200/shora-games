const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// In-memory database (for demo)
let users = [];

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
    
    // Validate input
    if (!phone || !email || !username || !password) {
        return res.status(400).json({ 
            error: 'All fields are required' 
        });
    }
    
    // Check if user exists
    const existingUser = users.find(u => u.phone === phone || u.email === email);
    if (existingUser) {
        return res.status(400).json({ 
            error: 'User already exists with this phone or email' 
        });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create new user
    const newUser = {
        id: users.length + 1,
        phone,
        email,
        username,
        password: hashedPassword,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    // Generate JWT token
    const token = jwt.sign(
        { id: newUser.id, phone: newUser.phone },
        'shora_secret_key_2026',
        { expiresIn: '7d' }
    );
    
    // Return user without password
    res.status(201).json({
        success: true,
        message: 'Account created successfully!',
        token,
        user: {
            id: newUser.id,
            phone: newUser.phone,
            email: newUser.email,
            username: newUser.username
        }
    });
});

// LOGIN endpoint
app.post('/api/auth/login', async (req, res) => {
    const { phone, password } = req.body;
    
    console.log('🔐 Login attempt:', { phone });
    
    if (!phone || !password) {
        return res.status(400).json({ 
            error: 'Phone number and password are required' 
        });
    }
    
    // Find user
    const user = users.find(u => u.phone === phone);
    if (!user) {
        return res.status(401).json({ 
            error: 'Invalid credentials' 
        });
    }
    
    // Check password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        return res.status(401).json({ 
            error: 'Invalid credentials' 
        });
    }
    
    // Generate token
    const token = jwt.sign(
        { id: user.id, phone: user.phone },
        'shora_secret_key_2026',
        { expiresIn: '7d' }
    );
    
    res.json({
        success: true,
        message: 'Login successful!',
        token,
        user: {
            id: user.id,
            phone: user.phone,
            email: user.email,
            username: user.username
        }
    });
});

// Get all users (for testing)
app.get('/api/users', (req, res) => {
    const usersList = users.map(({ password, ...rest }) => rest);
    res.json(usersList);
});

// Start server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`✅ Shora Games Backend is running!`);
    console.log(`📍 API URL: http://localhost:${PORT}`);
    console.log(`🧪 Test API: http://localhost:${PORT}/api/health`);
    console.log(`📋 Users registered: ${users.length}`);
});