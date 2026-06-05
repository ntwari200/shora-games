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

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://shora-games-default-rtdb.firebaseio.com/"
});

const db = admin.database();
const usersRef = db.ref('users');

const app = express();
app.use(cors());
app.use(express.json());

// HEALTH CHECK
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Shora Games API running!' });
});

// REGISTER
app.post('/api/auth/register', async (req, res) => {
    const { phone, email, username, password } = req.body;
    
    if (!phone || !email || !username || !password) {
        return res.status(400).json({ error: 'All fields required' });
    }
    
    try {
        // Check if user exists in Firebase
        const snapshot = await usersRef.once('value');
        let existingUser = null;
        snapshot.forEach(child => {
            if (child.val().phone === phone || child.val().email === email) {
                existingUser = child.val();
            }
        });
        
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserRef = usersRef.push();
        const userId = newUserRef.key;
        
        await newUserRef.set({
            id: userId,
            phone,
            email,
            username,
            password: hashedPassword,
            createdAt: new Date().toISOString(),
            balance: 0,
            gamesPlayed: 0
        });
        
        const token = jwt.sign({ id: userId, phone }, process.env.JWT_SECRET || 'shora_secret', { expiresIn: '7d' });
        
        res.status(201).json({
            success: true,
            message: 'Account created!',
            token,
            user: { id: userId, phone, email, username }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// LOGIN
app.post('/api/auth/login', async (req, res) => {
    const { phone, password } = req.body;
    
    try {
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
        
        const isValid = await bcrypt.compare(password, foundUser.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const token = jwt.sign({ id: userId, phone }, process.env.JWT_SECRET || 'shora_secret', { expiresIn: '7d' });
        
        res.json({
            success: true,
            message: 'Login successful!',
            token,
            user: { id: userId, phone: foundUser.phone, email: foundUser.email, username: foundUser.username }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
