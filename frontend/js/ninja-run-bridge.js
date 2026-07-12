// ============================================================
// NINJA RUN - UNIFIED BRIDGE v5
// Combines: Game Over Detection + Timer Sync + Round Integration
// Location: frontend/js/ninja-run-bridge.js
// ============================================================

(function() {
    'use strict';

    console.log('🏃 Ninja Run Unified Bridge v5 loaded');

    // ============================================================
    // CONFIG
    // ============================================================

    const CONFIG = {
        eventId: getParam('event'),
        userId: getParam('user'),
        isDemo: getParam('demo') === 'true',
        maxWaitTime: 60000,
        scoreSubmitDelay: 1000,
        maxGameTime: 300000,
        roundCheckInterval: 5000,
        scoreCheckInterval: 200,
        gameOverCheckInterval: 300,
        winThreshold: 100,
        entryFee: 100,
        winAmount: 200
    };

    function getParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    // ============================================================
    // SIDS FROM data.js (EXACT MATCH)
    // ============================================================

    const SIDS = {
        Player:   6015150563090787,
        Bomb:     2366045084376254,
        GameOver: 9673310750545146,
        Restart:  3517756744458917,
        Play:     4863784351268309
    };

    // ============================================================
    // STATE
    // ============================================================

    let gameScore = 0;
    let scoreSubmitted = false;
    let gameStarted = false;
    let gameEndDetected = false;
    let firstGameOverDetected = false;
    let gameStartTime = Date.now();
    let runtime = null;
    let scoreInterval = null;
    let gameOverInterval = null;
    let roundInterval = null;
    let redirectTimer = null;

    // Round timer state
    let roundTimerInterval = null;
    let roundTimeRemaining = 0;
    let roundActive = false;
    let roundData = null;

    console.log(`📋 Event ID: ${CONFIG.eventId || 'DEMO'}`);
    console.log(`👤 User ID: ${CONFIG.userId || 'GUEST'}`);
    console.log(`🎯 Mode: ${CONFIG.isDemo ? 'DEMO' : 'TOURNAMENT'}`);

    // ============================================================
    // RUNTIME HELPERS
    // ============================================================

    function getRuntime() {
        try {
            // Check if running inside iframe
            if (window.c2runtime) return window.c2runtime;
            if (window.cr && window.cr.runtime) return window.cr.runtime;
            
            // Check canvas
            const canvas = document.getElementById('c2canvas');
            if (canvas && canvas.c2runtime) return canvas.c2runtime;
            
            // Check iframe contentWindow
            const iframe = document.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                if (iframe.contentWindow.c2runtime) return iframe.contentWindow.c2runtime;
                if (iframe.contentWindow.cr && iframe.contentWindow.cr.runtime) {
                    return iframe.contentWindow.cr.runtime;
                }
            }
            
            return null;
        } catch(e) { return null; }
    }

    function getTypeBySid(runtime, sid) {
        if (!runtime || !runtime.types_by_index) return null;
        for (const t of runtime.types_by_index) {
            if (t && t.sid === sid) return t;
        }
        return null;
    }

    // ============================================================
    // COIN SCORE DETECTION
    // ============================================================

    function findCoinScore() {
        let score = 0;
        let found = false;

        try {
            const rt = getRuntime();
            if (rt) {
                // Check globalVars
                if (rt.globalVars) {
                    for (const key in rt.globalVars) {
                        const lowerKey = key.toLowerCase();
                        const coinKeys = ['coins', 'coin', 'coincount', 'coin_counter', 
                                         'coin_count', 'totalcoins', 'coinsscore', 
                                         'coin_score', 'coinscore', 'score', 'points'];
                        if (coinKeys.includes(lowerKey)) {
                            const val = rt.globalVars[key];
                            if (typeof val === 'number' && val > score) {
                                score = val;
                                found = true;
                            }
                        }
                    }
                }
                
                // Check all_global_vars
                if (rt.all_global_vars) {
                    for (const v of rt.all_global_vars) {
                        if (v && v.name) {
                            const lowerName = v.name.toLowerCase();
                            const coinKeys = ['coins', 'coin', 'coincount', 'coin_counter', 
                                             'coin_count', 'totalcoins', 'coinsscore', 
                                             'coin_score', 'coinscore', 'score', 'points'];
                            if (coinKeys.includes(lowerName)) {
                                const val = v.data || 0;
                                if (typeof val === 'number' && val > score) {
                                    score = val;
                                    found = true;
                                }
                            }
                        }
                    }
                }
            }

            // Check DOM elements
            if (!found || score === 0) {
                const coinSelectors = [
                    '.coins', '.coin', '#coins', '#coin',
                    '.coin-count', '.coinCounter',
                    '[class*="coin"]', '[id*="coin"]',
                    '.score-display', '.score-value', '.score',
                    '[class*="score"]', '[id*="score"]'
                ];
                
                for (const selector of coinSelectors) {
                    try {
                        const elements = document.querySelectorAll(selector);
                        for (const el of elements) {
                            const text = el.textContent || el.innerText || '';
                            const num = parseInt(text.replace(/[^0-9]/g, ''));
                            if (!isNaN(num) && num > score) {
                                score = num;
                                found = true;
                            }
                        }
                    } catch (e) {}
                }
            }

            // Check localStorage
            if (!found || score === 0) {
                const storedScore = localStorage.getItem('ninjarun_score');
                if (storedScore) {
                    const num = parseInt(storedScore);
                    if (!isNaN(num) && num > score) {
                        score = num;
                        found = true;
                    }
                }
                const liveScore = sessionStorage.getItem('ninjaRunLiveScore');
                if (liveScore) {
                    const num = parseInt(liveScore);
                    if (!isNaN(num) && num > score) {
                        score = num;
                        found = true;
                    }
                }
            }

        } catch (e) {}

        return score;
    }

    // ============================================================
    // GAME OVER DETECTION (SIDS-based)
    // ============================================================

    function detectGameOver() {
        let isGameOver = false;
        let reason = '';

        try {
            const rt = getRuntime();
            if (rt) {
                // Signal 1: "Distances" group deactivated
                try {
                    const g = rt.groups_by_name && rt.groups_by_name['distances'];
                    if (g && g.group_active === false) {
                        isGameOver = true;
                        reason = 'Distances group deactivated';
                        return { isGameOver, reason };
                    }
                } catch(e) {}

                // Signal 2: Player instance destroyed
                const playerType = getTypeBySid(rt, SIDS.Player);
                if (playerType && playerType.instances && playerType.instances.length === 0) {
                    isGameOver = true;
                    reason = 'Player destroyed';
                    return { isGameOver, reason };
                }

                // Signal 3: GameOver panel slid into view
                const goType = getTypeBySid(rt, SIDS.GameOver);
                if (goType && goType.instances && goType.instances.length) {
                    const y = goType.instances[0].y || 0;
                    if (y > 100) {
                        isGameOver = true;
                        reason = 'GameOver panel on screen (y=' + y + ')';
                        return { isGameOver, reason };
                    }
                }

                // Signal 4: Check global vars for GameOver
                if (rt.globalVars) {
                    const gameOverKeys = ['GameOver', 'gameOver', 'GAME_OVER', 
                                         'gameOverState', 'isGameOver', 
                                         'game_end', 'gameEnd', 'dead', 'Died'];
                    for (const key of gameOverKeys) {
                        if (rt.globalVars[key] === true || rt.globalVars[key] === 1) {
                            isGameOver = true;
                            reason = `globalVars.${key} = ${rt.globalVars[key]}`;
                            return { isGameOver, reason };
                        }
                    }
                }

                if (rt.all_global_vars) {
                    for (const v of rt.all_global_vars) {
                        if (v && v.name) {
                            const lowerName = v.name.toLowerCase();
                            if (lowerName.includes('gameover') || lowerName.includes('game_over') || 
                                lowerName.includes('end') || lowerName.includes('die') || 
                                lowerName.includes('dead')) {
                                if (v.data === true || v.data === 1) {
                                    isGameOver = true;
                                    reason = `all_global_vars.${v.name} = ${v.data}`;
                                    return { isGameOver, reason };
                                }
                            }
                        }
                    }
                }
            }

            // DOM fallback
            const gameOverSelectors = [
                '.gameover', '.game-over', '#gameover', '#game-over',
                '.gameover-screen', '.game-over-screen',
                '.gameover-overlay', '.game-over-overlay',
                '.death-screen', '.game-end'
            ];
            
            for (const selector of gameOverSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && 
                            el.style.display !== 'none' && 
                            el.style.visibility !== 'hidden' &&
                            el.offsetParent !== null) {
                            isGameOver = true;
                            reason = `DOM element: ${selector}`;
                            return { isGameOver, reason };
                        }
                    }
                } catch (e) {}
            }

            // Restart button detection
            const restartSelectors = [
                '.restart-btn', '#restart', '.btn-restart', 
                '.restart-button', '#restartButton',
                '.btnrestart', '#btnrestart', '.game-restart'
            ];
            
            for (const selector of restartSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0 && 
                            el.style.display !== 'none' && 
                            el.offsetParent !== null) {
                            const text = (el.textContent || '').toLowerCase();
                            if (text.includes('restart') || text.includes('replay') || 
                                text.includes('try again') || text.includes('retry')) {
                                isGameOver = true;
                                reason = `Restart button: ${selector}`;
                                return { isGameOver, reason };
                            }
                        }
                    }
                } catch (e) {}
            }

        } catch (e) {}

        return { isGameOver, reason };
    }

    // ============================================================
    // ROUND TIMER SYSTEM
    // ============================================================

    function getRoundData() {
        try {
            const data = localStorage.getItem('shora_current_round');
            if (data) {
                return JSON.parse(data);
            }
        } catch(e) {}
        return null;
    }

    function getRoundDuration() {
        const round = getRoundData();
        if (round && round.status === 'active' && round.endTime) {
            const remaining = Math.floor((round.endTime - Date.now()) / 1000);
            return Math.max(0, remaining);
        }
        return 300; // 5 minutes default
    }

    function updateTimerDisplay(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

        // Update game runtime timer
        try {
            const rt = getRuntime();
            if (rt && rt.globalVars) {
                const timerKeys = ['timer', 'time', 'countdown', 'roundTime', 'gameTime'];
                for (const key of timerKeys) {
                    if (rt.globalVars[key] !== undefined) {
                        rt.globalVars[key] = seconds;
                    }
                }
            }
        } catch(e) {}

        // Update overlay
        let timerOverlay = document.getElementById('gameTimerOverlay');
        if (!timerOverlay) {
            timerOverlay = document.createElement('div');
            timerOverlay.id = 'gameTimerOverlay';
            timerOverlay.style.cssText = `
                position: fixed;
                top: 70px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 99999;
                font-family: 'Orbitron', monospace;
                font-size: 1.2rem;
                color: #FFD700;
                text-shadow: 0 0 20px rgba(255,215,0,0.3);
                background: rgba(6,17,31,0.7);
                padding: 6px 20px;
                border-radius: 10px;
                border: 1px solid rgba(255,215,0,0.2);
                backdrop-filter: blur(8px);
                display: none;
                pointer-events: none;
            `;
            document.body.appendChild(timerOverlay);
        }
        
        if (seconds > 0) {
            timerOverlay.textContent = `⏰ ${timeStr}`;
            timerOverlay.style.display = 'block';
            
            if (seconds < 30) {
                timerOverlay.style.color = '#FF4D6D';
                timerOverlay.style.borderColor = 'rgba(255,77,109,0.3)';
            } else if (seconds < 60) {
                timerOverlay.style.color = '#FFC857';
                timerOverlay.style.borderColor = 'rgba(255,200,87,0.3)';
            } else {
                timerOverlay.style.color = '#FFD700';
                timerOverlay.style.borderColor = 'rgba(255,215,0,0.2)';
            }
        } else {
            timerOverlay.style.display = 'none';
        }
    }

    function startRoundTimer() {
        if (roundTimerInterval) {
            clearInterval(roundTimerInterval);
            roundTimerInterval = null;
        }

        const remaining = getRoundDuration();
        roundTimeRemaining = remaining;
        updateTimerDisplay(remaining);

        roundTimerInterval = setInterval(() => {
            roundTimeRemaining--;
            updateTimerDisplay(roundTimeRemaining);

            // Check if round ended
            if (roundTimeRemaining <= 0) {
                clearInterval(roundTimerInterval);
                roundTimerInterval = null;
                roundActive = false;
                console.log('⏰ Round timer expired!');
                
                // If game is still running, force game over
                if (!firstGameOverDetected && gameScore > 0 && !CONFIG.isDemo) {
                    console.log('🎯 Round ended - forcing game over');
                    firstGameOverDetected = true;
                    gameEndDetected = true;
                    blockRestartButton();
                    
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            const finalScore = gameScore;
                            scoreSubmitted = true;
                            sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                            sessionStorage.setItem('ninjaRunPlayed', 'true');
                            sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                            sessionStorage.setItem('ninjaRunComplete', 'true');
                            showGameOverOverlay(finalScore, CONFIG.isDemo);
                        }
                    }, CONFIG.scoreSubmitDelay);
                }
            }
        }, 1000);
    }

    function checkRoundStatus() {
        const round = getRoundData();
        if (!round) return;

        roundData = round;

        if (round.status === 'active') {
            if (!roundActive) {
                roundActive = true;
                console.log('🔄 Round is active, starting timer');
                startRoundTimer();
            }
        } else if (round.status === 'ended') {
            if (roundActive) {
                roundActive = false;
                if (roundTimerInterval) {
                    clearInterval(roundTimerInterval);
                    roundTimerInterval = null;
                }
                console.log('🏁 Round ended');
                
                // Force game over if still playing
                if (!firstGameOverDetected && gameScore > 0 && !CONFIG.isDemo) {
                    firstGameOverDetected = true;
                    gameEndDetected = true;
                    blockRestartButton();
                    
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            const finalScore = gameScore;
                            scoreSubmitted = true;
                            sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                            sessionStorage.setItem('ninjaRunPlayed', 'true');
                            sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                            sessionStorage.setItem('ninjaRunComplete', 'true');
                            showGameOverOverlay(finalScore, CONFIG.isDemo);
                        }
                    }, CONFIG.scoreSubmitDelay);
                }
            }
        }
    }

    // ============================================================
    // BLOCK RESTART BUTTON
    // ============================================================

    function blockRestartButton() {
        try {
            const restartSelectors = [
                '.restart-btn', '#restart', '.btn-restart', 
                '.restart-button', '#restartButton',
                '.btnrestart', '#btnrestart', '.game-restart',
                'button[onclick*="restart"]', 'div[onclick*="restart"]'
            ];

            for (const selector of restartSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    el.style.pointerEvents = 'none';
                    el.style.opacity = '0.5';
                    el.style.cursor = 'default';
                    el.disabled = true;
                    const newEl = el.cloneNode(true);
                    el.parentNode.replaceChild(newEl, el);
                }
            }

            // Override restart functions
            ['restartGame', 'restart', 'resetGame', 'reset', 'playAgain', 'retry'].forEach(function(funcName) {
                if (typeof window[funcName] === 'function') {
                    window[funcName] = function() {
                        console.log('🚫 Restart blocked');
                        return false;
                    };
                }
            });

            console.log('✅ Restart buttons blocked');

        } catch (e) {
            console.log('⚠️ Could not block restart:', e);
        }
    }

    // ============================================================
    // SHOW GAME OVER OVERLAY
    // ============================================================

    function showGameOverOverlay(score, isDemo) {
        const existing = document.getElementById('ninjaRunGameOverOverlay');
        if (existing) existing.remove();

        const isDemoMode = CONFIG.isDemo || isDemo;
        const overlay = document.createElement('div');
        overlay.id = 'ninjaRunGameOverOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.92);
            backdrop-filter: blur(16px);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            font-family: 'Orbitron', monospace;
            color: #fff;
            animation: fadeIn 0.6s ease;
        `;

        overlay.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes loadBar {
                    0% { width: 0%; }
                    100% { width: 100%; }
                }
            </style>
            <div style="
                background: linear-gradient(145deg, #0B1F36, #06111F);
                border: 2px solid ${isDemoMode ? '#FFD700' : '#00E676'};
                border-radius: 24px;
                padding: 40px 50px;
                text-align: center;
                max-width: 450px;
                width: 90%;
                box-shadow: 0 0 80px ${isDemoMode ? 'rgba(255, 215, 0, 0.1)' : 'rgba(0, 230, 118, 0.1)'};
                animation: slideUp 0.5s ease;
            ">
                <div style="font-size: 4rem; margin-bottom: 8px;">
                    ${isDemoMode ? '🎮' : '🏆'}
                </div>
                <h2 style="
                    font-family: 'Orbitron', monospace;
                    color: ${isDemoMode ? '#FFD700' : '#00E676'};
                    font-size: 1.4rem;
                    margin-bottom: 4px;
                ">
                    ${isDemoMode ? 'Demo Complete!' : 'Game Over!'}
                </h2>
                
                <div style="
                    font-size: 3rem;
                    color: #FFD700;
                    font-weight: 700;
                    margin: 12px 0;
                    font-family: 'Orbitron', monospace;
                ">
                    ${score.toLocaleString()}
                </div>
                <div style="color: #A7B5C5; font-size: 0.85rem;">
                    ${isDemoMode ? 'coins (demo)' : 'coins collected'}
                </div>

                ${!isDemoMode ? `
                    <div style="
                        margin-top: 16px;
                        padding: 10px 20px;
                        background: rgba(0, 230, 118, 0.05);
                        border: 1px solid rgba(0, 230, 118, 0.1);
                        border-radius: 12px;
                    ">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                            <div style="
                                width: 16px;
                                height: 16px;
                                border: 2px solid rgba(0, 230, 118, 0.2);
                                border-top: 2px solid #00E676;
                                border-radius: 50%;
                                animation: spin 0.8s linear infinite;
                            "></div>
                            <span style="color: #00E676; font-size: 0.8rem;">
                                ⏳ Submitting score...
                            </span>
                        </div>
                    </div>
                ` : ''}

                ${isDemoMode ? `
                    <button onclick="window.location.reload()" style="
                        margin-top: 20px;
                        background: linear-gradient(135deg, #FFD700, #FFA000);
                        border: none;
                        border-radius: 10px;
                        color: #000;
                        padding: 12px 30px;
                        font-family: 'Orbitron', monospace;
                        font-weight: 700;
                        font-size: 0.8rem;
                        cursor: pointer;
                        transition: all 0.3s ease;
                    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                        🔄 Play Again (Demo)
                    </button>
                ` : `
                    <div style="margin-top: 20px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="color: var(--muted); font-size: 0.65rem;">
                            ⏳ Redirecting to tournament...
                        </div>
                        <div style="
                            width: 100%;
                            height: 3px;
                            background: rgba(255,255,255,0.05);
                            border-radius: 2px;
                            overflow: hidden;
                        ">
                            <div style="
                                height: 100%;
                                width: 0%;
                                background: linear-gradient(90deg, #00BFFF, #6C63FF);
                                border-radius: 2px;
                                animation: loadBar 3s ease forwards;
                            "></div>
                        </div>
                    </div>
                `}
            </div>
        `;

        document.body.appendChild(overlay);

        if (!isDemoMode) {
            setTimeout(() => {
                if (CONFIG.eventId) {
                    window.location.href = `tournaments.html?id=${CONFIG.eventId}`;
                } else {
                    window.location.href = 'tournaments.html';
                }
            }, 3500);
        }
    }

    // ============================================================
    // SUBMIT SCORE
    // ============================================================

    function submitScore(score) {
        if (scoreSubmitted) return;
        const finalScore = parseInt(score) || gameScore || 0;

        if (CONFIG.isDemo) {
            scoreSubmitted = true;
            sessionStorage.setItem('ninjaRunScore', finalScore.toString());
            sessionStorage.setItem('ninjaRunPlayed', 'true');
            sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
            sessionStorage.setItem('ninjaRunComplete', 'true');
            showGameOverOverlay(finalScore, true);
            return;
        }

        if (finalScore === 0) {
            console.log('⚠️ Score is 0, not submitting');
            return;
        }

        scoreSubmitted = true;
        sessionStorage.setItem('ninjaRunScore', finalScore.toString());
        sessionStorage.setItem('ninjaRunPlayed', 'true');
        sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
        sessionStorage.setItem('ninjaRunComplete', 'true');

        // Send to parent
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({
                    type: 'NINJA_RUN_COMPLETE',
                    score: finalScore,
                    coins: finalScore,
                    eventId: CONFIG.eventId,
                    userId: CONFIG.userId,
                    isDemo: false,
                    timestamp: Date.now()
                }, '*');
            } catch (e) {}
        }

        // Submit to Firebase
        if (typeof firebase !== 'undefined' && firebase.database && CONFIG.eventId && CONFIG.userId) {
            try {
                const db = firebase.database();
                const scoreRef = db.ref(`tournaments/${CONFIG.eventId}/players/${CONFIG.userId}`);
                scoreRef.update({
                    score: finalScore,
                    coins: finalScore,
                    hasPlayed: true,
                    submittedAt: Date.now(),
                    username: `Player_${CONFIG.userId.slice(0, 6)}`
                }).then(() => {
                    console.log('✅ Score submitted to Firebase:', finalScore);
                }).catch(function(err) {
                    console.error('❌ Firebase error:', err);
                });
            } catch (error) {
                console.error('❌ Error submitting to Firebase:', error);
            }
        }

        showGameOverOverlay(finalScore, false);
    }

    // ============================================================
    // MAIN MONITORING LOOP
    // ============================================================

    function monitorGame() {
        try {
            // 1. Update score
            const currentScore = findCoinScore();
            if (currentScore > gameScore) {
                gameScore = currentScore;
                console.log(`🪙 Coins updated: ${gameScore}`);
                sessionStorage.setItem('ninjaRunLiveScore', gameScore.toString());
                
                if (window.parent && window.parent !== window) {
                    try {
                        window.parent.postMessage({
                            type: 'NINJA_RUN_SCORE',
                            score: gameScore,
                            coins: gameScore
                        }, '*');
                    } catch (e) {}
                }
            }
            
            // 2. Check game over (ONLY ONCE)
            if (!firstGameOverDetected && gameScore > 0) {
                const gameState = detectGameOver();
                if (gameState.isGameOver) {
                    firstGameOverDetected = true;
                    gameEndDetected = true;
                    console.log(`🎯 FIRST GAME OVER: ${gameState.reason}`);
                    blockRestartButton();
                    
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            const finalScore = gameScore;
                            console.log(`📤 Submitting score: ${finalScore}`);
                            submitScore(finalScore);
                        }
                    }, CONFIG.scoreSubmitDelay);
                }
            }

            // 3. Check round status
            if (!firstGameOverDetected && !CONFIG.isDemo) {
                checkRoundStatus();
            }

            // 4. Timeout check
            if (!scoreSubmitted && !firstGameOverDetected && gameStarted) {
                const elapsed = Date.now() - gameStartTime;
                if (elapsed > CONFIG.maxGameTime && gameScore > 0) {
                    console.log('⏰ Max game time reached');
                    firstGameOverDetected = true;
                    gameEndDetected = true;
                    blockRestartButton();
                    
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            submitScore(gameScore);
                        }
                    }, CONFIG.scoreSubmitDelay);
                }
            }

            // 5. Mark started
            if (gameScore > 0 && !gameStarted) {
                gameStarted = true;
                console.log('🎮 Game started');
            }

        } catch (e) {}
    }

    // ============================================================
    // WAIT FOR RUNTIME
    // ============================================================

    function waitForRuntime() {
        console.log('⏳ Waiting for Construct 2 runtime...');
        
        let attempts = 0;
        const maxAttempts = 50;
        const startTime = Date.now();
        
        const checkRuntime = setInterval(() => {
            attempts++;
            const elapsed = Date.now() - startTime;
            
            try {
                const rt = getRuntime();
                if (rt) {
                    clearInterval(checkRuntime);
                    runtime = rt;
                    console.log('✅ Runtime detected');
                    gameStarted = true;
                    startMonitoring();
                    return;
                }
            } catch (e) {}
            
            if (attempts >= maxAttempts || elapsed > CONFIG.maxWaitTime) {
                clearInterval(checkRuntime);
                console.log('⚠️ Runtime detection timed out');
                startFallbackMonitoring();
            }
        }, 500);
    }

    // ============================================================
    // START MONITORING
    // ============================================================

    function startMonitoring() {
        console.log('📊 Starting monitoring');
        
        // Score check - every 200ms
        if (scoreInterval) clearInterval(scoreInterval);
        scoreInterval = setInterval(monitorGame, CONFIG.scoreCheckInterval);
        
        // Game over check - every 300ms
        if (gameOverInterval) clearInterval(gameOverInterval);
        gameOverInterval = setInterval(() => {
            if (!firstGameOverDetected && gameScore > 0) {
                const gameState = detectGameOver();
                if (gameState.isGameOver) {
                    firstGameOverDetected = true;
                    gameEndDetected = true;
                    console.log(`🎯 GAME OVER: ${gameState.reason}`);
                    blockRestartButton();
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            submitScore(gameScore);
                        }
                    }, CONFIG.scoreSubmitDelay);
                }
            }
        }, CONFIG.gameOverCheckInterval);
        
        // Round check - every 5 seconds
        if (roundInterval) clearInterval(roundInterval);
        roundInterval = setInterval(() => {
            if (!CONFIG.isDemo) {
                checkRoundStatus();
            }
        }, CONFIG.roundCheckInterval);
    }

    // ============================================================
    // FALLBACK MONITORING
    // ============================================================

    function startFallbackMonitoring() {
        console.log('📊 Starting fallback monitoring');
        
        if (scoreInterval) clearInterval(scoreInterval);
        scoreInterval = setInterval(() => {
            try {
                // Check session storage
                const liveScore = sessionStorage.getItem('ninjaRunLiveScore');
                if (liveScore) {
                    const score = parseInt(liveScore);
                    if (score > gameScore) {
                        gameScore = score;
                    }
                }
                
                // Check completion
                const complete = sessionStorage.getItem('ninjaRunComplete');
                if (complete === 'true' && !scoreSubmitted) {
                    const finalScore = sessionStorage.getItem('ninjaRunFinalScore');
                    if (finalScore) {
                        console.log('🎯 Completion detected from session');
                        firstGameOverDetected = true;
                        blockRestartButton();
                        scoreSubmitted = true;
                        showGameOverOverlay(parseInt(finalScore), CONFIG.isDemo);
                        return;
                    }
                }
                
                // Check DOM game over
                if (!firstGameOverDetected && gameScore > 0) {
                    const gameState = detectGameOver();
                    if (gameState.isGameOver) {
                        firstGameOverDetected = true;
                        gameEndDetected = true;
                        console.log(`🎯 GAME OVER (fallback): ${gameState.reason}`);
                        blockRestartButton();
                        setTimeout(() => {
                            if (!scoreSubmitted) {
                                submitScore(gameScore);
                            }
                        }, CONFIG.scoreSubmitDelay);
                    }
                }
                
                // Timeout
                if (gameScore > 0 && !scoreSubmitted && gameStarted) {
                    const elapsed = Date.now() - gameStartTime;
                    if (elapsed > CONFIG.maxGameTime) {
                        console.log('⏰ Auto-submit after max time');
                        firstGameOverDetected = true;
                        blockRestartButton();
                        setTimeout(() => {
                            if (!scoreSubmitted) {
                                submitScore(gameScore);
                            }
                        }, CONFIG.scoreSubmitDelay);
                    }
                }
                
            } catch (e) {}
        }, 500);
    }

    // ============================================================
    // MANUAL OVERRIDE
    // ============================================================

    window.forceGameOver = function(score) {
        if (firstGameOverDetected) return;
        
        const finalScore = score || gameScore || 0;
        console.log('🔧 Force game over triggered');
        
        firstGameOverDetected = true;
        gameEndDetected = true;
        blockRestartButton();
        
        setTimeout(() => {
            if (!scoreSubmitted) {
                submitScore(finalScore);
            }
        }, CONFIG.scoreSubmitDelay);
    };

    window.getNinjaRunStatus = function() {
        return {
            score: gameScore,
            coins: gameScore,
            submitted: scoreSubmitted,
            started: gameStarted,
            ended: gameEndDetected,
            firstGameOver: firstGameOverDetected,
            runtime: !!runtime,
            eventId: CONFIG.eventId,
            userId: CONFIG.userId,
            isDemo: CONFIG.isDemo,
            roundActive: roundActive,
            roundTimeRemaining: roundTimeRemaining,
            monitoring: !!(scoreInterval || gameOverInterval)
        };
    };

    // ============================================================
    // MESSAGE LISTENER
    // ============================================================

    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'NINJA_RUN_FORCE_GAME_OVER') {
            console.log('📨 Received force game over message');
            window.forceGameOver(event.data.score);
        }
        if (event.data && event.data.type === 'NINJA_RUN_COMPLETE') {
            console.log('📨 Received completion message');
            if (!firstGameOverDetected) {
                firstGameOverDetected = true;
                blockRestartButton();
                const score = event.data.score || event.data.coins || gameScore;
                scoreSubmitted = true;
                showGameOverOverlay(score, CONFIG.isDemo);
            }
        }
        if (event.data && event.data.type === 'ROUND_ENDED') {
            console.log('📨 Round ended message received');
            if (!firstGameOverDetected && gameScore > 0 && !CONFIG.isDemo) {
                firstGameOverDetected = true;
                blockRestartButton();
                setTimeout(() => {
                    if (!scoreSubmitted) {
                        submitScore(gameScore);
                    }
                }, CONFIG.scoreSubmitDelay);
            }
        }
    });

    // ============================================================
    // CLEANUP
    // ============================================================

    window.addEventListener('beforeunload', function() {
        if (scoreInterval) clearInterval(scoreInterval);
        if (gameOverInterval) clearInterval(gameOverInterval);
        if (roundInterval) clearInterval(roundInterval);
        if (roundTimerInterval) clearInterval(roundTimerInterval);
        
        if (gameScore > 0 && !scoreSubmitted && !CONFIG.isDemo) {
            console.log('🔄 Page closing, submitting final score');
            const finalScore = gameScore;
            sessionStorage.setItem('ninjaRunScore', finalScore.toString());
            sessionStorage.setItem('ninjaRunPlayed', 'true');
            sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
            sessionStorage.setItem('ninjaRunComplete', 'true');
            
            if (window.parent && window.parent !== window) {
                try {
                    window.parent.postMessage({
                        type: 'NINJA_RUN_COMPLETE',
                        score: finalScore,
                        coins: finalScore,
                        eventId: CONFIG.eventId,
                        userId: CONFIG.userId,
                        isDemo: false,
                        timestamp: Date.now()
                    }, '*');
                } catch (e) {}
            }
        }
    });

    // ============================================================
    // EXPOSE DEBUG
    // ============================================================

    window.__ninjaDebug = {
        score: () => gameScore,
        coins: () => gameScore,
        status: () => window.getNinjaRunStatus(),
        forceGameOver: (score) => window.forceGameOver(score),
        config: CONFIG,
        SIDS: SIDS,
        detectGameOver: () => detectGameOver(),
        findCoins: () => findCoinScore(),
        blockRestart: () => blockRestartButton(),
        getRuntime: () => getRuntime(),
        getRoundData: () => getRoundData(),
        getRoundDuration: () => getRoundDuration()
    };

    // ============================================================
    // INIT
    // ============================================================

    console.log('🚀 Ninja Run Unified Bridge v5 (Game Over + Timer) initializing...');
    console.log('🎯 Mode:', CONFIG.isDemo ? 'DEMO' : 'TOURNAMENT');
    console.log('🔒 SIDS:', SIDS);
    console.log('⏰ Round timer sync: Enabled');
    console.log('📊 For debugging: __ninjaDebug.status()');
    console.log('🔧 Force game over: __ninjaDebug.forceGameOver(score)');

    // Start
    waitForRuntime();

    // Periodic check for runtime
    setInterval(() => {
        if (!runtime && !firstGameOverDetected) {
            const rt = getRuntime();
            if (rt) {
                runtime = rt;
                console.log('✅ Runtime detected via periodic check');
                gameStarted = true;
                startMonitoring();
            }
        }
    }, 2000);

})();
