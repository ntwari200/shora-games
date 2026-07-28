const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE
// ============================================
app.use(cors());
app.use(express.json());

// ============================================
// FIREBASE ADMIN
// ============================================
let serviceAccount;
try {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } else {
        serviceAccount = require('./serviceAccountKey.json');
    }
} catch (error) {
    console.error('❌ Firebase service account error:', error.message);
}

if (serviceAccount) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://shora-games-default-rtdb.firebaseio.com/'
    });
    console.log('✅ Firebase initialized');
}

const firebaseDb = admin.database ? admin.database() : null;

// ============================================
// NEON DATABASE
// ============================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.connect((err) => {
    if (err) {
        console.error('❌ Neon connection error:', err.message);
    } else {
        console.log('✅ Connected to Neon PostgreSQL');
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getUserFromFirebase(uid) {
    if (!firebaseDb) return null;
    try {
        const snapshot = await firebaseDb.ref(`users/${uid}`).once('value');
        return snapshot.exists() ? snapshot.val() : null;
    } catch (error) {
        console.error('Error fetching user:', error);
        return null;
    }
}

async function updateUserBalance(uid, newBalance) {
    if (!firebaseDb) return false;
    try {
        await firebaseDb.ref(`users/${uid}/balance`).set(newBalance);
        return true;
    } catch (error) {
        console.error('Error updating balance:', error);
        return false;
    }
}

// ===== RECALCULATE POSITIONS =====
async function recalculatePositions(tournamentId) {
    try {
        // Get all players sorted by score
        const players = await pool.query(
            `SELECT id, user_id, score, time_finished 
             FROM tournament_players 
             WHERE tournament_id = $1 AND has_played = true
             ORDER BY score DESC, time_finished ASC`,
            [tournamentId]
        );

        // Update positions
        for (let i = 0; i < players.rows.length; i++) {
            const position = i + 1;
            await pool.query(
                'UPDATE tournament_players SET position = $1 WHERE id = $2',
                [position, players.rows[i].id]
            );
        }

        // Get tournament prize distribution
        const tournament = await pool.query(
            'SELECT prize_distribution FROM tournaments WHERE id = $1',
            [tournamentId]
        );

        if (tournament.rows.length > 0) {
            const prizeDist = tournament.rows[0].prize_distribution || {};
            
            // Update prize won for each player
            for (let i = 0; i < players.rows.length; i++) {
                const position = i + 1;
                const prizeWon = prizeDist[position] || 0;
                await pool.query(
                    'UPDATE tournament_players SET prize_won = $1 WHERE id = $2',
                    [prizeWon, players.rows[i].id]
                );
            }
        }

        console.log(`✅ Positions recalculated for tournament ${tournamentId}`);
        return players.rows.length;
    } catch (error) {
        console.error('Error recalculating positions:', error);
        return 0;
    }
}

// ============================================
// API ROUTES
// ============================================

// Health Check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ 
            status: 'healthy', 
            neon: 'connected',
            firebase: !!firebaseDb,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
    }
});

// Get all tournaments
app.get('/api/tournaments', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM tournaments ORDER BY created_at DESC'
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get single tournament with players
app.get('/api/tournaments/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const tournament = await pool.query(
            'SELECT * FROM tournaments WHERE id = $1',
            [id]
        );
        
        if (tournament.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        const players = await pool.query(
            `SELECT * FROM tournament_players 
             WHERE tournament_id = $1 
             ORDER BY position ASC NULLS LAST, score DESC`,
            [id]
        );

        res.json({
            tournament: tournament.rows[0],
            players: players.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get tournament rankings
app.get('/api/rankings/:tournamentId', async (req, res) => {
    const { tournamentId } = req.params;
    try {
        const result = await pool.query(
            `SELECT 
                user_id, username, phone, score, time_finished,
                position, prize_won, has_played, finished_at, cheated, cheat_reason
             FROM tournament_players 
             WHERE tournament_id = $1
             ORDER BY position ASC NULLS LAST, score DESC, time_finished ASC`,
            [tournamentId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching rankings:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create tournament (from admin)
app.post('/api/tournaments', async (req, res) => {
    const {
        id, name, game, image_url, entry_fee, prize_pool,
        platform_fee_percent, distribution_model, prize_distribution,
        max_players, min_players, duration, status, locked, description, end_time, created_at
    } = req.body;

    if (!id || !name || !game) {
        return res.status(400).json({ error: 'id, name, and game required' });
    }

    try {
        const result = await pool.query(
            `INSERT INTO tournaments (
                id, name, game, image_url, entry_fee, prize_pool,
                platform_fee_percent, distribution_model, prize_distribution,
                max_players, min_players, duration, status, locked, description, end_time, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, game = EXCLUDED.game,
                image_url = EXCLUDED.image_url, entry_fee = EXCLUDED.entry_fee,
                prize_pool = EXCLUDED.prize_pool,
                platform_fee_percent = EXCLUDED.platform_fee_percent,
                distribution_model = EXCLUDED.distribution_model,
                prize_distribution = EXCLUDED.prize_distribution,
                max_players = EXCLUDED.max_players, min_players = EXCLUDED.min_players,
                duration = EXCLUDED.duration, status = EXCLUDED.status,
                locked = EXCLUDED.locked, description = EXCLUDED.description,
                end_time = EXCLUDED.end_time,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *`,
            [
                id, name, game, image_url, entry_fee || 100, prize_pool || 0,
                platform_fee_percent || 10, distribution_model || 'dynamic',
                JSON.stringify(prize_distribution || {}),
                max_players || 50, min_players || 2, duration || 30,
                status || 'soon', locked || false, description || '',
                end_time || null, created_at || new Date().toISOString()
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error creating tournament:', err);
        res.status(500).json({ error: err.message });
    }
});

// Join tournament
app.post('/api/tournaments/:id/join', async (req, res) => {
    const { id } = req.params;
    const { user_id, username, phone } = req.body;

    if (!user_id || !username) {
        return res.status(400).json({ error: 'user_id and username required' });
    }

    try {
        const tournamentResult = await pool.query(
            'SELECT * FROM tournaments WHERE id = $1 AND status = $2',
            [id, 'live']
        );

        if (tournamentResult.rows.length === 0) {
            return res.status(400).json({ error: 'Tournament not available' });
        }

        const tournament = tournamentResult.rows[0];

        const existingPlayer = await pool.query(
            'SELECT * FROM tournament_players WHERE tournament_id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (existingPlayer.rows.length > 0) {
            return res.status(400).json({ error: 'Already joined' });
        }

        const playerCount = await pool.query(
            'SELECT COUNT(*) FROM tournament_players WHERE tournament_id = $1',
            [id]
        );

        if (parseInt(playerCount.rows[0].count) >= tournament.max_players) {
            return res.status(400).json({ error: 'Tournament is full' });
        }

        // Check balance in Firebase
        const userData = await getUserFromFirebase(user_id);
        if (!userData) {
            return res.status(404).json({ error: 'User not found' });
        }

        const balance = userData.balance || 0;
        const entryFee = tournament.entry_fee || 100;

        if (balance < entryFee) {
            return res.status(400).json({ 
                error: 'Insufficient balance', 
                required: entryFee, 
                available: balance 
            });
        }

        // Deduct entry fee
        await updateUserBalance(user_id, balance - entryFee);

        // Add player
        const result = await pool.query(
            `INSERT INTO tournament_players (
                tournament_id, user_id, username, phone, joined_at
            ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            RETURNING *`,
            [id, user_id, username, phone || '']
        );

        res.json({
            success: true,
            player: result.rows[0],
            balance: balance - entryFee
        });

    } catch (err) {
        console.error('Error joining tournament:', err);
        res.status(500).json({ error: err.message });
    }
});

// ===== SUBMIT SCORE - CLEAN VERSION =====
app.post('/api/rankings/submit', async (req, res) => {
    const { 
        tournament_id, 
        user_id, 
        username, 
        phone, 
        score, 
        time_finished, 
        finished_at,
        cheated,
        cheat_reason,
        auto_submitted
    } = req.body;

    console.log('📥 Received score submission:', {
        tournament_id,
        user_id,
        username,
        score,
        time_finished,
        cheated
    });

    if (!tournament_id || !user_id || score === undefined) {
        return res.status(400).json({ 
            error: 'tournament_id, user_id, and score required' 
        });
    }

    try {
        // ===== 1. Check if tournament exists =====
        const tournamentResult = await pool.query(
            'SELECT * FROM tournaments WHERE id = $1',
            [tournament_id]
        );

        if (tournamentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Tournament not found' });
        }

        // ===== 2. Check if player already exists =====
        const existingPlayer = await pool.query(
            'SELECT * FROM tournament_players WHERE tournament_id = $1 AND user_id = $2',
            [tournament_id, user_id]
        );

        let result;
        const finalUsername = username || 'Player_' + user_id.slice(0, 6);
        const finalPhone = phone || '';

        if (existingPlayer.rows.length > 0) {
            // ===== UPDATE existing player =====
            result = await pool.query(
                `UPDATE tournament_players 
                 SET score = $1, 
                     time_finished = $2, 
                     has_played = true,
                     finished_at = COALESCE($3, CURRENT_TIMESTAMP),
                     cheated = $4,
                     cheat_reason = $5,
                     username = $6,
                     phone = $7
                 WHERE tournament_id = $8 AND user_id = $9
                 RETURNING *`,
                [
                    score, 
                    time_finished || 0, 
                    finished_at || null,
                    cheated || false,
                    cheat_reason || null,
                    finalUsername,
                    finalPhone,
                    tournament_id, 
                    user_id
                ]
            );
            console.log('✅ Updated existing player:', result.rows[0].id);
        } else {
            // ===== INSERT new player =====
            result = await pool.query(
                `INSERT INTO tournament_players (
                    tournament_id, user_id, username, phone, score, 
                    time_finished, finished_at, has_played, cheated, cheat_reason
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9)
                RETURNING *`,
                [
                    tournament_id, 
                    user_id, 
                    finalUsername, 
                    finalPhone, 
                    score, 
                    time_finished || 0, 
                    finished_at || new Date().toISOString(),
                    cheated || false,
                    cheat_reason || null
                ]
            );
            console.log('✅ Inserted new player:', result.rows[0].id);
        }

        // ===== 3. Recalculate positions =====
        await recalculatePositions(tournament_id);

        // ===== 4. Get updated position =====
        const positionResult = await pool.query(
            'SELECT position FROM tournament_players WHERE id = $1',
            [result.rows[0].id]
        );

        console.log(`✅ Score submitted: ${score} for user ${user_id} in tournament ${tournament_id}`);

        res.json({ 
            success: true, 
            player: result.rows[0],
            position: positionResult.rows[0]?.position || 0
        });

    } catch (err) {
        console.error('❌ Error submitting score:', err);
        res.status(500).json({ error: err.message });
    }
});

// Get revenue
app.get('/api/revenue', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT 
                COALESCE(SUM(total_entry_fees), 0) as total_entry_fees,
                COALESCE(SUM(total_prizes), 0) as total_prizes,
                COALESCE(SUM(platform_fee), 0) as total_platform_fee,
                COALESCE(SUM(player_count), 0) as total_players,
                COUNT(*) as tournament_count
             FROM platform_revenue`
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log(`🚀 API Server running on port ${PORT}`);
    console.log(`📡 Neon: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
    console.log(`🔥 Firebase: ${process.env.FIREBASE_SERVICE_ACCOUNT ? 'Configured' : 'Not configured'}`);
});
