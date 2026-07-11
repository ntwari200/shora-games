// ========================================
// NINJA RUN - BRIDGE SCRIPT v4 (FINAL)
// FIRST GAME OVER DETECTION + AUTO-REDIRECT
// ========================================

(function() {
    'use strict';

    console.log('🏃 Ninja Run Bridge v4 (First Game Over Detection) loaded');

    // ========================================
    // CONFIG
    // ========================================

    const CONFIG = {
        eventId: getParam('event'),
        userId: getParam('user'),
        isDemo: getParam('demo') === 'true',
        maxWaitTime: 60000,
        scoreSubmitDelay: 1000, // 1 second after game over
        maxGameTime: 300000,
    };

    function getParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    // ========================================
    // STATE
    // ========================================

    let gameScore = 0;
    let scoreSubmitted = false;
    let gameStarted = false;
    let checkInterval = null;
    let runtime = null;
    let gameEndDetected = false;
    let firstGameOverDetected = false;
    let gameStartTime = Date.now();
    let originalRestartHandler = null;
    let redirectTimer = null;
    let gameOverScreenVisible = false;

    console.log(`📋 Event ID: ${CONFIG.eventId || 'DEMO'}`);
    console.log(`👤 User ID: ${CONFIG.userId || 'GUEST'}`);
    console.log(`🎯 Mode: ${CONFIG.isDemo ? 'DEMO' : 'TOURNAMENT'}`);

    // ========================================
    // CORE: FIND COINS IN THE GAME
    // ========================================

    function findCoinScore() {
        let score = 0;
        let found = false;

        try {
            if (runtime) {
                // Check globalVars
                if (runtime.globalVars) {
                    for (const key in runtime.globalVars) {
                        const lowerKey = key.toLowerCase();
                        const coinKeys = ['coins', 'coin', 'coincount', 'coin_counter', 
                                         'coin_count', 'totalcoins', 'coinsscore', 
                                         'coin_score', 'coinscore'];
                        if (coinKeys.includes(lowerKey)) {
                            const val = runtime.globalVars[key];
                            if (typeof val === 'number' && val > score) {
                                score = val;
                                found = true;
                            }
                        }
                    }
                }
                
                if (runtime.all_global_vars) {
                    for (const v of runtime.all_global_vars) {
                        if (v && v.name) {
                            const lowerName = v.name.toLowerCase();
                            const coinKeys = ['coins', 'coin', 'coincount', 'coin_counter', 
                                             'coin_count', 'totalcoins', 'coinsscore', 
                                             'coin_score', 'coinscore'];
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
                    '[data-coins]', '[data-coin]',
                    '.coin-count', '.coinCounter',
                    '[class*="coin"]', '[id*="coin"]',
                    '.coin-display', '.coin-score',
                    '.score-display', '.score-value'
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

            // Check window object
            if (!found || score === 0) {
                const coinNames = ['coins', 'coin', 'coinCount', 'coin_counter', 
                                  'coin_count', 'totalCoins', 'coinScore'];
                for (const name of coinNames) {
                    if (typeof window[name] !== 'undefined') {
                        const val = window[name];
                        if (typeof val === 'number' && val > score) {
                            score = val;
                            found = true;
                        }
                    }
                }
            }

        } catch (e) {}

        return score;
    }

    // ========================================
    // CORE: DETECT GAME OVER (FIRST TIME ONLY)
    // ========================================

    function detectGameOver() {
        let isGameOver = false;
        let reason = '';

        try {
            // ========================================
            // METHOD 1: Construct 2 Runtime
            // ========================================
            
            if (runtime) {
                if (runtime.globalVars) {
                    const gameOverKeys = ['GameOver', 'gameOver', 'GAME_OVER', 
                                         'gameOverState', 'isGameOver', 
                                         'game_end', 'gameEnd', 'dead', 'Died'];
                    for (const key of gameOverKeys) {
                        const val = runtime.globalVars[key];
                        if (val === true || val === 1 || val === 'true') {
                            isGameOver = true;
                            reason = `runtime.globalVars[${key}] = ${val}`;
                            return { isGameOver, reason };
                        }
                    }
                }
                
                if (runtime.all_global_vars) {
                    for (const v of runtime.all_global_vars) {
                        if (v && v.name) {
                            const lowerName = v.name.toLowerCase();
                            if (lowerName.includes('gameover') || lowerName.includes('game_over') || 
                                lowerName.includes('end') || lowerName.includes('die') || 
                                lowerName.includes('dead') || lowerName.includes('finished')) {
                                if (v.data === true || v.data === 1 || v.data === 'true') {
                                    isGameOver = true;
                                    reason = `runtime.all_global_vars[${v.name}] = ${v.data}`;
                                    return { isGameOver, reason };
                                }
                            }
                        }
                    }
                }
            }

            // ========================================
            // METHOD 2: DOM Game Over Elements
            // ========================================
            
            const gameOverSelectors = [
                '.gameover', '.game-over', '#gameover', '#game-over',
                '[data-gameover]', '.gameover-screen', '.game-over-screen',
                '.gameover-overlay', '.game-over-overlay',
                '.death-screen', '.game-end', '.gameover-panel',
                '.gameover-container', '.game-over-container'
            ];
            
            for (const selector of gameOverSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && 
                                         el.style.display !== 'none' && 
                                         el.style.visibility !== 'hidden' &&
                                         el.offsetParent !== null;
                        if (isVisible) {
                            isGameOver = true;
                            reason = `DOM element visible: ${selector}`;
                            return { isGameOver, reason };
                        }
                    }
                } catch (e) {}
            }

            // ========================================
            // METHOD 3: Restart Button Detection
            // ========================================
            
            try {
                const restartSelectors = [
                    '.restart-btn', '#restart', '[data-restart]',
                    '.btn-restart', '.restart-button', '#restartButton',
                    '.btnrestart', '#btnrestart', '.game-restart',
                    'button[onclick*="restart"]', 'div[onclick*="restart"]'
                ];
                
                for (const selector of restartSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        const rect = el.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && 
                                         el.style.display !== 'none' && 
                                         el.offsetParent !== null;
                        if (isVisible) {
                            const text = (el.textContent || '').toLowerCase();
                            if (text.includes('restart') || text.includes('replay') || 
                                text.includes('try again') || text.includes('retry') ||
                                text.includes('play again')) {
                                isGameOver = true;
                                reason = `Restart button visible: ${selector}`;
                                return { isGameOver, reason };
                            }
                        }
                    }
                }
            } catch (e) {}

            // ========================================
            // METHOD 4: Player Death Detection
            // ========================================
            
            try {
                if (runtime && runtime.types) {
                    for (const type of runtime.types_by_index) {
                        if (type && type.name) {
                            const lowerName = type.name.toLowerCase();
                            if (lowerName.includes('player') || lowerName.includes('ninja')) {
                                if (type.instances && type.instances.length === 0) {
                                    isGameOver = true;
                                    reason = 'Player instance destroyed';
                                    return { isGameOver, reason };
                                }
                                // Check if player is off screen
                                if (type.instances && type.instances.length > 0) {
                                    const player = type.instances[0];
                                    if (player.y > 800 || player.y < -100) {
                                        isGameOver = true;
                                        reason = 'Player fell off screen';
                                        return { isGameOver, reason };
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {}

        } catch (e) {}

        return { isGameOver, reason };
    }

    // ========================================
    // BLOCK RESTART BUTTON
    // ========================================

    function blockRestartButton() {
        try {
            // Method 1: Find and disable all restart buttons
            const restartSelectors = [
                '.restart-btn', '#restart', '[data-restart]',
                '.btn-restart', '.restart-button', '#restartButton',
                '.btnrestart', '#btnrestart', '.game-restart',
                'button[onclick*="restart"]', 'div[onclick*="restart"]'
            ];

            for (const selector of restartSelectors) {
                const elements = document.querySelectorAll(selector);
                for (const el of elements) {
                    // Disable the element
                    el.style.pointerEvents = 'none';
                    el.style.opacity = '0.5';
                    el.style.cursor = 'default';
                    el.disabled = true;
                    
                    // Remove click handlers
                    const newEl = el.cloneNode(true);
                    el.parentNode.replaceChild(newEl, el);
                }
            }

            // Method 2: Override the restart function if it exists
            if (typeof window.restartGame === 'function') {
                window.restartGame = function() {
                    console.log('🚫 Restart blocked - game already ended');
                    return false;
                };
            }

            if (typeof window.restart === 'function') {
                window.restart = function() {
                    console.log('🚫 Restart blocked - game already ended');
                    return false;
                };
            }

            // Method 3: Block keyboard shortcuts (R key for restart)
            document.addEventListener('keydown', function(e) {
                if (e.key === 'r' || e.key === 'R' || e.key === 'Enter') {
                    // Check if we're on game over screen
                    const gameOverElements = document.querySelectorAll('.gameover, .game-over, #gameover, #game-over');
                    for (const el of gameOverElements) {
                        if (el.offsetParent !== null) {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('🚫 Restart key blocked');
                            return false;
                        }
                    }
                }
            }, true);

            console.log('✅ Restart button blocked');

        } catch (e) {
            console.log('⚠️ Could not block restart button:', e);
        }
    }

    // ========================================
    // SHOW GAME OVER OVERLAY
    // ========================================

    function showGameOverOverlay(score, isDemo) {
        // Remove any existing overlay
        const existing = document.getElementById('ninjaRunGameOverOverlay');
        if (existing) existing.remove();

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

        const isDemoMode = CONFIG.isDemo || isDemo;

        overlay.innerHTML = `
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.05); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(30px); }
                    to { opacity: 1; transform: translateY(0); }
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

                <div style="
                    margin-top: 16px;
                    font-size: 0.7rem;
                    color: rgba(255,255,255,0.3);
                ">
                    ${isDemoMode ? '🎮 Continue playing' : '⏳ Please wait...'}
                </div>

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
                        <style>
                            @keyframes loadBar {
                                0% { width: 0%; }
                                100% { width: 100%; }
                            }
                        </style>
                    </div>
                `}
            </div>
        `;

        document.body.appendChild(overlay);

        // For tournament mode: redirect after 3 seconds
        if (!isDemoMode) {
            setTimeout(() => {
                // Show "redirecting" message
                const redirectMsg = document.createElement('div');
                redirectMsg.style.cssText = `
                    position: fixed;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(6, 17, 31, 0.95);
                    border: 1px solid rgba(0, 191, 255, 0.2);
                    border-radius: 50px;
                    padding: 10px 24px;
                    color: #A7B5C5;
                    font-size: 0.8rem;
                    z-index: 100000;
                    font-family: 'Inter', sans-serif;
                    animation: slideUp 0.3s ease;
                `;
                redirectMsg.textContent = '🔄 Redirecting to tournament rankings...';
                document.body.appendChild(redirectMsg);

                setTimeout(() => {
                    // Redirect to tournament page
                    if (CONFIG.eventId) {
                        window.location.href = `tournaments.html?id=${CONFIG.eventId}`;
                    } else {
                        window.location.href = 'tournaments.html';
                    }
                }, 3000);
            }, 1500);
        }
    }

    // ========================================
    // MAIN LOOP: MONITOR GAME STATE
    // ========================================

    function monitorGame() {
        try {
            // 1. Get current coin score
            const currentScore = findCoinScore();
            
            // 2. Update if changed
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
            
            // 3. Check for game over - ONLY ONCE!
            if (!firstGameOverDetected && gameScore > 0) {
                const gameState = detectGameOver();
                if (gameState.isGameOver) {
                    firstGameOverDetected = true;
                    gameEndDetected = true;
                    
                    console.log(`🎯 FIRST GAME OVER detected: ${gameState.reason}`);
                    console.log(`📊 Final score: ${gameScore}`);
                    
                    // Block restart button immediately
                    blockRestartButton();
                    
                    // Get final score
                    const finalScore = findCoinScore() || gameScore;
                    
                    // Submit score after short delay
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            console.log(`📤 Submitting final score: ${finalScore}`);
                            
                            // For tournament mode
                            if (!CONFIG.isDemo) {
                                // Submit to parent
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
                                
                                // Store in session
                                sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunPlayed', 'true');
                                sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunComplete', 'true');
                                
                                scoreSubmitted = true;
                                
                                // Show game over overlay (tournament mode)
                                showGameOverOverlay(finalScore, false);
                                
                                // Also try to submit to Firebase
                                if (typeof firebase !== 'undefined' && firebase.database) {
                                    submitToFirebase(finalScore);
                                }
                                
                            } else {
                                // Demo mode - just show overlay
                                scoreSubmitted = true;
                                sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunPlayed', 'true');
                                sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunComplete', 'true');
                                
                                showGameOverOverlay(finalScore, true);
                            }
                        }
                    }, CONFIG.scoreSubmitDelay);
                }
            }

            // 4. If game over was already detected, keep blocking restart
            if (firstGameOverDetected) {
                // Periodically re-block restart buttons (in case game recreates them)
                blockRestartButton();
            }

            // 5. Check for timeout
            if (!scoreSubmitted && !firstGameOverDetected && gameStarted) {
                const elapsed = Date.now() - gameStartTime;
                if (elapsed > CONFIG.maxGameTime && gameScore > 0) {
                    console.log(`⏰ Max game time exceeded. Forcing game over.`);
                    firstGameOverDetected = true;
                    gameEndDetected = true;
                    
                    // Block restart
                    blockRestartButton();
                    
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            const finalScore = gameScore;
                            scoreSubmitted = true;
                            
                            if (!CONFIG.isDemo) {
                                sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunPlayed', 'true');
                                sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunComplete', 'true');
                                
                                showGameOverOverlay(finalScore, false);
                                
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
                            } else {
                                showGameOverOverlay(finalScore, true);
                            }
                        }
                    }, 500);
                }
            }

            // 6. Mark as started
            if (gameScore > 0 && !gameStarted) {
                gameStarted = true;
                console.log('🎮 Game started (coins detected)');
            }

        } catch (e) {
            // Silent fail
        }
    }

    // ========================================
    // SUBMIT TO FIREBASE
    // ========================================

    function submitToFirebase(score) {
        try {
            if (typeof firebase === 'undefined' || !firebase.database) {
                console.log('ℹ️ Firebase not available, using localStorage');
                return;
            }
            
            const db = firebase.database();
            const eventId = CONFIG.eventId;
            const userId = CONFIG.userId;
            
            if (!eventId || !userId) {
                console.log('ℹ️ No event/user ID, skipping Firebase');
                return;
            }
            
            const scoreRef = db.ref(`tournaments/${eventId}/players/${userId}`);
            
            const scoreData = {
                score: score,
                coins: score,
                hasPlayed: true,
                submittedAt: Date.now(),
                username: `Player_${userId.slice(0, 6)}`
            };
            
            scoreRef.update(scoreData)
                .then(() => {
                    console.log('✅ Score submitted to Firebase:', score);
                })
                .catch((error) => {
                    console.error('❌ Firebase error:', error);
                });
                
        } catch (error) {
            console.error('❌ Error submitting to Firebase:', error);
        }
    }

    // ========================================
    // WAIT FOR RUNTIME
    // ========================================

    function waitForRuntime() {
        console.log('⏳ Waiting for Construct 2 runtime...');
        
        let attempts = 0;
        const maxAttempts = 50;
        const startTime = Date.now();
        
        const checkRuntime = setInterval(() => {
            attempts++;
            const elapsed = Date.now() - startTime;
            
            try {
                const canvas = document.getElementById('c2canvas');
                if (canvas && canvas.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = canvas.c2runtime;
                    console.log('✅ Construct 2 Runtime detected');
                    gameStarted = true;
                    startMonitoring();
                    return;
                }
                
                if (window.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = window.c2runtime;
                    console.log('✅ Runtime detected via window');
                    gameStarted = true;
                    startMonitoring();
                    return;
                }
                
                if (window.c2canvas && window.c2canvas.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = window.c2canvas.c2runtime;
                    console.log('✅ Runtime detected via c2canvas');
                    gameStarted = true;
                    startMonitoring();
                    return;
                }
                
            } catch (e) {}
            
            if (attempts >= maxAttempts || elapsed > CONFIG.maxWaitTime) {
                clearInterval(checkRuntime);
                console.log('⚠️ Runtime detection timed out, using fallback');
                startFallbackMonitoring();
            }
        }, 500);
    }

    // ========================================
    // FALLBACK MONITORING
    // ========================================

    function startFallbackMonitoring() {
        console.log('📊 Starting fallback monitoring');
        
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        
        checkInterval = setInterval(() => {
            try {
                // Check session storage
                const liveScore = sessionStorage.getItem('ninjaRunLiveScore');
                if (liveScore !== null) {
                    const score = parseInt(liveScore);
                    if (score > gameScore) {
                        gameScore = score;
                    }
                }
                
                // Check for completion flag
                const complete = sessionStorage.getItem('ninjaRunComplete');
                if (complete === 'true' && !scoreSubmitted) {
                    const finalScore = sessionStorage.getItem('ninjaRunFinalScore');
                    if (finalScore !== null) {
                        console.log('🎯 Game completion detected from session');
                        firstGameOverDetected = true;
                        blockRestartButton();
                        scoreSubmitted = true;
                        showGameOverOverlay(parseInt(finalScore), CONFIG.isDemo);
                        return;
                    }
                }
                
                // Check DOM for game over
                if (!firstGameOverDetected && gameScore > 0) {
                    const gameState = detectGameOver();
                    if (gameState.isGameOver) {
                        firstGameOverDetected = true;
                        gameEndDetected = true;
                        console.log(`🎯 Game Over detected (fallback): ${gameState.reason}`);
                        blockRestartButton();
                        
                        setTimeout(() => {
                            if (!scoreSubmitted) {
                                const finalScore = gameScore;
                                scoreSubmitted = true;
                                sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunPlayed', 'true');
                                sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunComplete', 'true');
                                
                                if (!CONFIG.isDemo) {
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
                                
                                showGameOverOverlay(finalScore, CONFIG.isDemo);
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
                                const finalScore = gameScore;
                                scoreSubmitted = true;
                                sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunPlayed', 'true');
                                sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                                sessionStorage.setItem('ninjaRunComplete', 'true');
                                showGameOverOverlay(finalScore, CONFIG.isDemo);
                            }
                        }, 500);
                    }
                }
                
            } catch (e) {}
        }, 500);
    }

    // ========================================
    // MANUAL OVERRIDE FUNCTIONS
    // ========================================

    window.forceGameOver = function(score) {
        if (firstGameOverDetected) return;
        
        const finalScore = score || gameScore || 0;
        console.log('🔧 Force game over triggered');
        
        firstGameOverDetected = true;
        gameEndDetected = true;
        blockRestartButton();
        
        setTimeout(() => {
            if (!scoreSubmitted) {
                scoreSubmitted = true;
                sessionStorage.setItem('ninjaRunScore', finalScore.toString());
                sessionStorage.setItem('ninjaRunPlayed', 'true');
                sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
                sessionStorage.setItem('ninjaRunComplete', 'true');
                showGameOverOverlay(finalScore, CONFIG.isDemo);
            }
        }, 500);
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
            monitoring: !!checkInterval
        };
    };

    // ========================================
    // LISTEN FOR MESSAGES
    // ========================================

    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'NINJA_RUN_FORCE_GAME_OVER') {
            console.log('📨 Received force game over message');
            window.forceGameOver(event.data.score);
        }
        if (event.data && event.data.type === 'NINJA_RUN_COMPLETE') {
            console.log('📨 Received completion message:', event.data);
            if (!firstGameOverDetected) {
                firstGameOverDetected = true;
                blockRestartButton();
                const score = event.data.score || event.data.coins || gameScore;
                scoreSubmitted = true;
                showGameOverOverlay(score, CONFIG.isDemo);
            }
        }
    });

    // ========================================
    // EXPOSE FOR DEBUGGING
    // ========================================

    window.__ninjaDebug = {
        score: () => gameScore,
        coins: () => gameScore,
        status: () => window.getNinjaRunStatus(),
        forceGameOver: (score) => window.forceGameOver(score),
        config: CONFIG,
        findCoins: () => findCoinScore(),
        detectGameOver: () => detectGameOver(),
        blockRestart: () => blockRestartButton()
    };

    // ========================================
    // CLEANUP
    // ========================================

    window.addEventListener('beforeunload', function() {
        if (checkInterval) {
            clearInterval(checkInterval);
        }
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

    // ========================================
    // INIT
    // ========================================

    console.log('🚀 Ninja Run Bridge v4 (First Game Over Detection) initializing...');
    console.log('🎯 Mode:', CONFIG.isDemo ? 'DEMO' : 'TOURNAMENT');
    console.log('🔒 First game over will be detected and restart will be blocked');
    console.log('📊 For debugging: __ninjaDebug.status()');
    console.log('🔧 Force game over: __ninjaDebug.forceGameOver(score)');

    waitForRuntime();

    // Also periodically check for game over even if runtime not found
    setInterval(() => {
        if (!runtime && !firstGameOverDetected && gameScore > 0) {
            const gameState = detectGameOver();
            if (gameState.isGameOver) {
                console.log('🎯 Game Over detected via periodic check');
                firstGameOverDetected = true;
                blockRestartButton();
                const finalScore = gameScore;
                setTimeout(() => {
                    if (!scoreSubmitted) {
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

})();
