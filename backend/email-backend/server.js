const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { Resend } = require('resend');

dotenv.config();

const app = express();

// CORS - Allow your frontend
app.use(cors({
    origin: ['https://shora-frontend.onrender.com', 'http://localhost:3000']
}));

app.use(express.json());

// Initialize Resend with your API key
const resend = new Resend(process.env.RESEND_API_KEY);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Shora Email Service running' });
});

// ============ SEND VERIFICATION EMAIL ============
app.post('/api/send-verification', async (req, res) => {
    const { email, username, code } = req.body;

    if (!email || !username || !code) {
        return res.status(400).json({ error: 'Email, username, and code are required' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'Shora Games <noreply@shora-games.com>',
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

        if (error) throw error;

        res.json({
            success: true,
            message: 'Verification email sent!',
            data
        });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============ SEND PASSWORD RESET EMAIL ============
app.post('/api/send-password-reset', async (req, res) => {
    const { email, username, resetLink } = req.body;

    if (!email || !username || !resetLink) {
        return res.status(400).json({ error: 'Email, username, and reset link are required' });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'Shora Games <noreply@shora-games.com>',
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

        res.json({
            success: true,
            message: 'Password reset email sent!',
            data
        });

    } catch (error) {
        console.error('Email error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`✅ Shora Email Service running on port ${PORT}`);
    console.log(`📧 Resend email service active`);
});
