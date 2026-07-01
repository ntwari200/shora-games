const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const { Resend } = require('resend');

dotenv.config();

const app = express();

// CORS - Allow requests from your frontend
app.use(cors({
    origin: ['https://shora-frontend.onrender.com', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// ============ INITIALIZE RESEND ============
const resend = new Resend(process.env.RESEND_API_KEY);

// ============ IN-MEMORY STORAGE ============
let users = [];
let verificationCodes = {}; // Store verification codes with email/phone

// ============ HELPERS ============
function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// ============ EMAIL FUNCTIONS ============
async function sendVerificationEmail(email, username, code) {
    try {
        const fromEmail = process.env.FROM_EMAIL || 'Shora Games <onboarding@resend.dev>';
        console.log(`📧 Sending verification email to ${email} from ${fromEmail}`);
        
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [email],
            subject: '🎮 Verify your Shora Games account',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f17; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #00BFFF;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #00BFFF; font-size: 28px;">🎮 SHORA GAMES</h1>
                        <p style="color: #94A3B8;">Play · Compete · Win</p>
                    </div>

                    <h2 style="color: #00BFFF;">Welcome, ${username}! 👋</h2>
                    <p style="color: #EAF4FF; line-height: 1.6;">Thank you for joining Shora Games! Please verify your email address to start competing.</p>

                    <div style="background: rgba(0, 191, 255, 0.1); border: 1px solid rgba(0, 191, 255, 0.3); border-radius: 12px; padding: 20px; margin: 30px 0; text-align: center;">
                        <p style="font-size: 14px; color: #94A3B8; margin-bottom: 10px;">Your verification code</p>
                        <div style="font-size: 36px; font-weight: 900; color: #00BFFF; letter-spacing: 8px;">${code}</div>
                    </div>

                    <p style="color: #94A3B8; font-size: 14px;">Enter this code on the website to verify your email.</p>
                    <p style="color: #94A3B8; font-size: 12px; margin-top: 20px;">This code expires in 15 minutes.</p>

                    <div style="border-top: 1px solid rgba(0, 191, 255, 0.2); margin-top: 30px; padding-top: 20px; text-align: center;">
                        <p style="color: #666; font-size: 12px;">If you didn't create an account, you can ignore this email.</p>
                        <p style="color: #666; font-size: 12px;">© 2026 Shora Games</p>
                    </div>
                </div>
            `,
        });

        if (error) {
            console.error('Resend error:', error);
            throw error;
        }
        return { success: true, data };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
}

async function sendPasswordResetEmail(email, username, resetLink) {
    try {
        const fromEmail = process.env.FROM_EMAIL || 'Shora Games <onboarding@resend.dev>';
        
        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: [email],
            subject: '🔐 Reset your Shora Games password',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0b0f17; color: #ffffff; padding: 40px; border-radius: 16px; border: 1px solid #00BFFF;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #00BFFF; font-size: 28px;">🔐 SHORA GAMES</h1>
                    </div>

                    <h2 style="color: #00BFFF;">Password Reset Request</h2>
                    <p style="color: #EAF4FF; line-height: 1.6;">Hello ${username},</p>
                    <p style="color: #EAF4FF; line-height: 1.6;">We received a request to reset your Shora Games password.</p>

                    <div style="text-align: center; margin: 30px 0;">
                        <a href="${resetLink}" style="background: linear-gradient(135deg, #00BFFF, #0088CC); color: #000; padding: 14px 32px; border-radius: 40px; text-decoration: none; font-weight: 700; display: inline-block;">Reset Password</a>
                    </div>

                    <p style="color: #94A3B8; font-size: 14px;">Or copy this link into your browser:</p>
                    <p style="color: #00BFFF; font-size: 12px; word-break: break-all; background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px;">${resetLink}</p>

                    <p style="color: #94A3B8; font-size: 12px; margin-top: 20px;">This link expires in 1 hour.</p>

                    <div style="border-top: 1px solid rgba(0, 191, 255, 0.2); margin-top: 30px; padding-top: 20px; text-align: center;">
                        <p style="color: #666; font-size: 12px;">If you didn't request this, you can ignore this email.</p>
                        <p style="color: #666; font-size: 12px;">© 2026 Shora Games</p>
                    </div>
                </div>
            `,
        });

        if (error) throw error;
        return { success: true, data };
    } catch (error) {
        console.error('Email send error:', error);
        return { success: false, error: error.message };
    }
}

// ============ HEALTH CHECK ============
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Shora Games API running with Resend!' });
});

// ============ REGISTER ============
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
        verified: false,
        createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    
    // Generate and store verification code
    const code = generateVerificationCode();
    verificationCodes[email] = {
        code,
        phone: phone,
        expiresAt: Date.now() + 15 * 60 * 1000 // 15 minutes
    };
    
    // Send verification email via Resend
    const emailResult = await sendVerificationEmail(email, username, code);
    
    const token = jwt.sign(
        { id: newUser.id, phone, email },
        process.env.JWT_SECRET || 'shora_secret_2026',
        { expiresIn: '7d' }
    );
    
    res.status(201).json({
        success: true,
        message: 'Account created! Please check your email for verification code.',
        token,
        emailSent: emailResult.success,
        user: { id: newUser.id, phone, email, username, verified: false }
    });
});

// ============ VERIFY EMAIL ============
app.post('/api/auth/verify-email', async (req, res) => {
    const { phone, email, code } = req.body;
    
    console.log('🔐 Verification attempt:', { phone, email });
    
    if (!email || !code) {
        return res.status(400).json({ error: 'Email and verification code required' });
    }
    
    const stored = verificationCodes[email];
    if (!stored) {
        return res.status(400).json({ error: 'No verification code found. Please request a new one.' });
    }
    
    if (stored.expiresAt < Date.now()) {
        delete verificationCodes[email];
        return res.status(400).json({ error: 'Verification code expired. Please request a new one.' });
    }
    
    if (stored.code !== code) {
        return res.status(400).json({ error: 'Invalid verification code' });
    }
    
    // Mark user as verified
    const user = users.find(u => u.email === email);
    if (user) {
        user.verified = true;
    }
    
    delete verificationCodes[email];
    
    res.json({
        success: true,
        message: 'Email verified successfully! You can now log in.'
    });
});

// ============ RESEND VERIFICATION CODE ============
app.post('/api/auth/resend-verification', async (req, res) => {
    const { phone, email } = req.body;
    
    console.log('🔄 Resend verification:', { phone, email });
    
    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.verified) {
        return res.status(400).json({ error: 'Email already verified' });
    }
    
    const code = generateVerificationCode();
    verificationCodes[email] = {
        code,
        phone: user.phone,
        expiresAt: Date.now() + 15 * 60 * 1000
    };
    
    const emailResult = await sendVerificationEmail(email, user.username, code);
    
    res.json({
        success: true,
        message: 'Verification code resent!',
        emailSent: emailResult.success
    });
});

// ============ LOGIN ============
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
    
    if (!user.verified) {
        return res.status(401).json({ 
            error: 'email_not_verified', 
            message: 'Please verify your email first. Check your inbox for the verification code.',
            email: user.email
        });
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

// ============ FORGOT PASSWORD ============
app.post('/api/auth/forgot-password', async (req, res) => {
    const { email } = req.body;
    
    console.log('🔑 Forgot password:', { email });
    
    if (!email) {
        return res.status(400).json({ error: 'Email required' });
    }
    
    const user = users.find(u => u.email === email);
    if (!user) {
        // For security, don't reveal if email exists
        return res.json({
            success: true,
            message: 'If an account exists with this email, a password reset link has been sent.'
        });
    }
    
    // Generate password reset token
    const resetToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || 'shora_secret_2026',
        { expiresIn: '1h' }
    );
    
    const resetLink = `https://shora-frontend.onrender.com/reset-password.html?token=${resetToken}`;
    
    const emailResult = await sendPasswordResetEmail(email, user.username, resetLink);
    
    res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.',
        emailSent: emailResult.success
    });
});

// ============ RESET PASSWORD ============
app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password required' });
    }
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'shora_secret_2026');
        const user = users.find(u => u.id === decoded.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        user.password = await bcrypt.hash(newPassword, 10);
        
        res.json({
            success: true,
            message: 'Password reset successfully!'
        });
    } catch (error) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
    }
});

// ============ GET ALL USERS (Testing) ============
app.get('/api/users', (req, res) => {
    const safeUsers = users.map(({ password, ...rest }) => rest);
    res.json(safeUsers);
});

// ============ 404 HANDLER ============
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// ============ START SERVER ============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Shora Games API running on port ${PORT}`);
    console.log(`📧 Resend email integration active`);
    console.log(`📋 Users in memory: ${users.length}`);
});
