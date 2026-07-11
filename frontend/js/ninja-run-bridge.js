// ========================================
// NINJA RUN - BRIDGE SCRIPT v3 (FIXED)
// Connects Construct 2 game to Shora Games Platform
// Location: frontend/js/ninja-run-bridge.js
// ========================================

(function() {
    'use strict';

    console.log('🏃 Ninja Run Bridge v3 (Coin Tracking) loaded');

    // ========================================
    // CONFIG
    // ========================================

    const CONFIG = {
        eventId: getParam('event'),
        userId: getParam('user'),
        isDemo: getParam('demo') === 'true',
        gameUrl: window.location.href,
        maxWaitTime: 60000, // 60 seconds to detect runtime
        scoreSubmitDelay: 2000, // 2 seconds after game over
        maxGameTime: 300000, // 5 minutes max
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
    let coinElements = [];
    let scoreCheckCount = 0;
    let lastKnownScore = 0;
    let gameStartTime = Date.now();

    console.log(`📋 Event ID: ${CONFIG.eventId || 'DEMO'}`);
    console.log(`👤 User ID: ${CONFIG.userId || 'GUEST'}`);
    console.log(`🎯 Mode: ${CONFIG.isDemo ? 'DEMO' : 'TOURNAMENT'}`);

    // ========================================
    // CORE: SCORE HANDLING (COINS ONLY)
    // ========================================

    window.ninjaRunComplete = function(score) {
        console.log('🎮 Game Complete! Score:', score);
        
        if (scoreSubmitted) {
            console.log('⚠️ Score already submitted');
            return;
        }

        const finalScore = parseInt(score) || gameScore || 0;
        gameScore = finalScore;
        
        console.log(`📊 Final Score (Coins): ${finalScore}`);
        sendScoreToParent(finalScore);
    };

    function sendScoreToParent(score) {
        console.log('📤 Sending score to parent:', score);
        
        const finalScore = parseInt(score) || 0;
        
        // Store in session storage (multiple keys for redundancy)
        sessionStorage.setItem('ninjaRunScore', finalScore.toString());
        sessionStorage.setItem('ninjaRunPlayed', 'true');
        sessionStorage.setItem('ninjaRunFinalScore', finalScore.toString());
        sessionStorage.setItem('ninjaRunComplete', 'true');
        sessionStorage.setItem('ninjaRunCoins', finalScore.toString());
        
        // Also store in localStorage as backup
        try {
            if (CONFIG.eventId) {
                localStorage.setItem('ninjaRunScore_' + CONFIG.eventId, finalScore.toString());
            }
            if (CONFIG.userId) {
                localStorage.setItem('ninjaRunPlayed_' + CONFIG.userId, 'true');
            }
            localStorage.setItem('ninjaRunCoins_' + Date.now(), finalScore.toString());
        } catch (e) {}
        
        // Send to parent via postMessage
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({
                    type: 'NINJA_RUN_COMPLETE',
                    score: finalScore,
                    coins: finalScore,
                    eventId: CONFIG.eventId,
                    userId: CONFIG.userId,
                    isDemo: CONFIG.isDemo,
                    timestamp: Date.now()
                }, '*');
                console.log('✅ Score sent to parent via postMessage');
            } catch (e) {
                console.log('⚠️ Could not send to parent:', e);
            }
        }

        // Try calling parent function
        if (window.parent && window.parent.onNinjaRunComplete) {
            try {
                window.parent.onNinjaRunComplete(finalScore, CONFIG.eventId, CONFIG.userId);
                console.log('✅ Score sent to parent via direct function');
            } catch (e) {
                console.log('⚠️ Could not call parent function:', e);
            }
        }

        scoreSubmitted = true;
        
        // Show completion message (only in tournament mode or if not in iframe)
        if (!CONFIG.isDemo || !window.parent || window.parent === window) {
            showCompletionMessage(finalScore);
        }
    }

    function showCompletionMessage(score) {
        // Check if overlay already exists
        if (document.getElementById('ninjaRunCompleteOverlay')) return;
        
        const overlay = document.createElement('div');
        overlay.id = 'ninjaRunCompleteOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.85);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            font-family: 'Orbitron', monospace;
            color: #fff;
            animation: fadeIn 0.5s ease;
        `;
        overlay.innerHTML = `
            <div style="
                background: linear-gradient(135deg, #06111F, #0B1F36);
                border: 2px solid ${CONFIG.isDemo ? '#FFD700' : '#00BFFF'};
                border-radius: 20px;
                padding: 30px 40px;
                text-align: center;
                max-width: 400px;
                box-shadow: 0 0 60px rgba(0, 191, 255, 0.2);
            ">
                <div style="font-size: 3.5rem; margin-bottom: 8px;">${CONFIG.isDemo ? '🎮' : '🏆'}</div>
                <h2 style="
                    font-family: 'Orbitron', monospace;
                    color: ${CONFIG.isDemo ? '#FFD700' : '#FFD700'};
                    font-size: 1.3rem;
                    margin-bottom: 6px;
                ">${CONFIG.isDemo ? 'Demo Complete!' : 'Game Complete!'}</h2>
                <div style="
                    font-size: 2.5rem;
                    color: #00E676;
                    font-weight: 700;
                    margin: 8px 0;
                ">${score}</div>
                <div style="color: #A7B5C5; font-size: 0.8rem;">${CONFIG.isDemo ? 'coins (demo)' : 'coins collected'}</div>
                <div style="margin-top: 12px; font-size: 0.7rem; color: #A7B5C5;">
                    ${CONFIG.isDemo ? '🎮 Practice mode' : '🏆 Score submitted!'}
                </div>
                <button onclick="window.close()" style="
                    margin-top: 20px;
                    background: linear-gradient(135deg, ${CONFIG.isDemo ? '#FFD700' : '#00BFFF'}, ${CONFIG.isDemo ? '#FFA000' : '#6C63FF'});
                    border: none;
                    color: #000;
                    padding: 10px 25px;
                    border-radius: 10px;
                    font-family: 'Orbitron', monospace;
                    font-weight: 700;
                    cursor: pointer;
                    font-size: 0.75rem;
                    transition: all 0.3s ease;
                " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                    ${CONFIG.isDemo ? '🎮 Continue' : '🏆 View Rankings'}
                </button>
            </div>
            <style>
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.9); }
                    to { opacity: 1; transform: scale(1); }
                }
            </style>
        `;
        document.body.appendChild(overlay);

        // Auto-close after 5 seconds (10 seconds for demo)
        const closeDelay = CONFIG.isDemo ? 10000 : 5000;
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                    if (!CONFIG.isDemo) {
                        window.close();
                    }
                }, 500);
            }
        }, closeDelay);
    }

    // ========================================
    // CORE: FIND COINS IN THE GAME
    // ========================================

    function findCoinScore() {
        let score = 0;
        let found = false;

        try {
            // ========================================
            // METHOD 1: Check Construct 2 Runtime
            // ========================================
            
            if (runtime) {
                // Check global vars
                if (runtime.globalVars) {
                    for (const key in runtime.globalVars) {
                        const lowerKey = key.toLowerCase();
                        // Track ONLY coin-related variables
                        if (lowerKey === 'coins' || lowerKey === 'coin' || 
                            lowerKey === 'coincount' || lowerKey === 'coin_counter' ||
                            lowerKey === 'coin_count' || lowerKey === 'totalcoins') {
                            const val = runtime.globalVars[key];
                            if (typeof val === 'number' && val > score) {
                                score = val;
                                found = true;
                                console.log(`🪙 Found coins in runtime.globalVars[${key}]: ${val}`);
                            }
                        }
                    }
                }
                
                // Check all global variables (all_global_vars)
                if (runtime.all_global_vars) {
                    for (const v of runtime.all_global_vars) {
                        if (v && v.name) {
                            const lowerName = v.name.toLowerCase();
                            if (lowerName === 'coins' || lowerName === 'coin' || 
                                lowerName === 'coincount' || lowerName === 'coin_counter' ||
                                lowerName === 'coin_count' || lowerName === 'totalcoins') {
                                const val = v.data || 0;
                                if (typeof val === 'number' && val > score) {
                                    score = val;
                                    found = true;
                                    console.log(`🪙 Found coins in runtime.all_global_vars[${v.name}]: ${val}`);
                                }
                            }
                        }
                    }
                }
                
                // Check layouts for coin variables
                if (runtime.layouts) {
                    for (const layoutName in runtime.layouts) {
                        const layout = runtime.layouts[layoutName];
                        if (layout && layout.globalVars) {
                            for (const key in layout.globalVars) {
                                const lowerKey = key.toLowerCase();
                                if (lowerKey === 'coins' || lowerKey === 'coin' || 
                                    lowerKey === 'coincount' || lowerKey === 'coin_counter' ||
                                    lowerKey === 'coin_count' || lowerKey === 'totalcoins') {
                                    const val = layout.globalVars[key];
                                    if (typeof val === 'number' && val > score) {
                                        score = val;
                                        found = true;
                                        console.log(`🪙 Found coins in layout[${layoutName}][${key}]: ${val}`);
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // ========================================
            // METHOD 2: Check DOM Elements
            // ========================================
            
            if (!found || score === 0) {
                const coinSelectors = [
                    '.coins', '.coin', '#coins', '#coin',
                    '[data-coins]', '[data-coin]',
                    '.coin-count', '.coinCounter',
                    '[class*="coin"]', '[id*="coin"]',
                    '.score', '#score', '.score-value',
                    '.score-display'
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
                                console.log(`🪙 Found coins in DOM [${selector}]: ${num}`);
                            }
                        }
                    } catch (e) {}
                }
            }

            // ========================================
            // METHOD 3: Check window object
            // ========================================
            
            if (!found || score === 0) {
                const coinNames = ['coins', 'coin', 'coinCount', 'coin_counter', 'coin_count', 'totalCoins'];
                for (const name of coinNames) {
                    if (typeof window[name] !== 'undefined') {
                        const val = window[name];
                        if (typeof val === 'number' && val > score) {
                            score = val;
                            found = true;
                            console.log(`🪙 Found coins in window[${name}]: ${val}`);
                        }
                    }
                }
            }

        } catch (e) {
            // Ignore errors
        }

        return score;
    }

    // ========================================
    // CORE: DETECT GAME OVER
    // ========================================

    function detectGameOver() {
        let isGameOver = false;
        let reason = '';

        try {
            // ========================================
            // METHOD 1: Check Construct 2 Runtime
            // ========================================
            
            if (runtime) {
                // Check global vars for game over flags
                if (runtime.globalVars) {
                    const gameOverKeys = ['GameOver', 'gameOver', 'GAME_OVER', 'gameOverState', 'isGameOver', 'game_end', 'gameEnd'];
                    for (const key of gameOverKeys) {
                        const val = runtime.globalVars[key];
                        if (val === true || val === 1 || val === 'true') {
                            isGameOver = true;
                            reason = `runtime.globalVars[${key}] = ${val}`;
                            console.log(`🎯 Game Over detected: ${reason}`);
                            return { isGameOver, reason };
                        }
                    }
                }
                
                // Check all global variables
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
                                    console.log(`🎯 Game Over detected: ${reason}`);
                                    return { isGameOver, reason };
                                }
                            }
                        }
                    }
                }
            }

            // ========================================
            // METHOD 2: Check DOM for Game Over Elements
            // ========================================
            
            const gameOverSelectors = [
                '.gameover', '.game-over', '#gameover', '#game-over',
                '[data-gameover]', '.gameover-screen', '.game-over-screen',
                '.gameover-overlay', '.game-over-overlay',
                '.death-screen', '.game-end', '.gameover-panel'
            ];
            
            for (const selector of gameOverSelectors) {
                try {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        if (el.style.display !== 'none' && el.style.display !== 'hidden') {
                            const isVisible = el.offsetParent !== null;
                            if (isVisible) {
                                isGameOver = true;
                                reason = `DOM element visible: ${selector}`;
                                console.log(`🎯 Game Over detected: ${reason}`);
                                return { isGameOver, reason };
                            }
                        }
                    }
                } catch (e) {}
            }

            // ========================================
            // METHOD 3: Check for player death
            // ========================================
            
            try {
                // Check if player exists and is alive
                if (runtime && runtime.types) {
                    for (const type of runtime.types_by_index) {
                        if (type && type.name && type.name.toLowerCase().includes('player')) {
                            if (type.instances && type.instances.length === 0) {
                                isGameOver = true;
                                reason = 'Player instance destroyed';
                                console.log(`🎯 Game Over detected: ${reason}`);
                                return { isGameOver, reason };
                            }
                        }
                    }
                }
            } catch (e) {}

            // ========================================
            // METHOD 4: Check for game over button (restart)
            // ========================================
            
            try {
                const restartSelectors = [
                    '.restart-btn', '#restart', '[data-restart]',
                    '.btn-restart', '.restart-button', '#restartButton',
                    'button:contains("Restart")', '.game-restart'
                ];
                
                for (const selector of restartSelectors) {
                    const elements = document.querySelectorAll(selector);
                    for (const el of elements) {
                        if (el.style.display !== 'none' && el.offsetParent !== null) {
                            const text = (el.textContent || '').toLowerCase();
                            if (text.includes('restart') || text.includes('replay') || text.includes('try again')) {
                                // If restart button is visible and interactive, game is over
                                isGameOver = true;
                                reason = `Restart button visible: ${selector}`;
                                console.log(`🎯 Game Over detected: ${reason}`);
                                return { isGameOver, reason };
                            }
                        }
                    }
                }
            } catch (e) {}

        } catch (e) {
            // Ignore errors
        }

        return { isGameOver, reason };
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
                
                // Send live update to parent
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
            
            // 3. Check for game over
            if (!gameEndDetected && gameScore > 0) {
                const gameState = detectGameOver();
                if (gameState.isGameOver) {
                    gameEndDetected = true;
                    console.log(`🎯 Game Over detected: ${gameState.reason}`);
                    
                    // Wait a moment before submitting (allow final score to update)
                    setTimeout(() => {
                        // Get final score one more time
                        const finalScore = findCoinScore() || gameScore;
                        if (finalScore > 0 && !scoreSubmitted) {
                            console.log(`📤 Submitting final score: ${finalScore}`);
                            window.ninjaRunComplete(finalScore);
                        } else if (scoreSubmitted) {
                            console.log('✅ Score already submitted');
                        } else {
                            console.log('⚠️ No score to submit');
                        }
                    }, CONFIG.scoreSubmitDelay);
                }
            }

            // 4. Check for timeout (max game time exceeded)
            if (!scoreSubmitted && !gameEndDetected && gameStarted) {
                const elapsed = Date.now() - gameStartTime;
                if (elapsed > CONFIG.maxGameTime && gameScore > 0) {
                    console.log(`⏰ Max game time exceeded (${CONFIG.maxGameTime}ms). Submitting score.`);
                    gameEndDetected = true;
                    setTimeout(() => {
                        if (!scoreSubmitted) {
                            window.ninjaRunComplete(gameScore);
                        }
                    }, 500);
                }
            }

            // 5. Mark as started if we have a score
            if (gameScore > 0 && !gameStarted) {
                gameStarted = true;
                console.log('🎮 Game started (coins detected)');
            }

        } catch (e) {
            // Silent fail
        }
    }

    // ========================================
    // HOOK INTO CONSTRUCT 2 RUNTIME
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
                // Try multiple ways to find the runtime
                const canvas = document.getElementById('c2canvas');
                if (canvas && canvas.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = canvas.c2runtime;
                    console.log('✅ Construct 2 Runtime detected via canvas');
                    gameStarted = true;
                    startMonitoring();
                    return;
                }
                
                if (window.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = window.c2runtime;
                    console.log('✅ Construct 2 Runtime detected via window');
                    gameStarted = true;
                    startMonitoring();
                    return;
                }
                
                if (window.c2canvas && window.c2canvas.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = window.c2canvas.c2runtime;
                    console.log('✅ Construct 2 Runtime detected via c2canvas');
                    gameStarted = true;
                    startMonitoring();
                    return;
                }
                
                // Try to find canvas in iframe
                const iframe = document.querySelector('iframe');
                if (iframe && iframe.contentWindow) {
                    const iframeWin = iframe.contentWindow;
                    if (iframeWin.c2runtime) {
                        clearInterval(checkRuntime);
                        runtime = iframeWin.c2runtime;
                        console.log('✅ Construct 2 Runtime detected via iframe');
                        gameStarted = true;
                        startMonitoring();
                        return;
                    }
                    if (iframeWin.c2canvas && iframeWin.c2canvas.c2runtime) {
                        clearInterval(checkRuntime);
                        runtime = iframeWin.c2canvas.c2runtime;
                        console.log('✅ Construct 2 Runtime detected via iframe canvas');
                        gameStarted = true;
                        startMonitoring();
                        return;
                    }
                }
                
            } catch (e) {}
            
            // Check if we should give up
            if (attempts >= maxAttempts || elapsed > CONFIG.maxWaitTime) {
                clearInterval(checkRuntime);
                console.log('⚠️ Runtime detection timed out, using fallback monitoring');
                startFallbackMonitoring();
            }
        }, 500);
    }

    // ========================================
    // START MONITORING
    // ========================================

    function startMonitoring() {
        console.log('🔍 Starting game monitoring...');
        
        // Clear any existing interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        
        // Monitor every 500ms
        checkInterval = setInterval(monitorGame, 500);
        
        // Do an initial check
        setTimeout(monitorGame, 100);
        
        console.log('✅ Game monitoring active');
    }

    // ========================================
    // FALLBACK MONITORING
    // ========================================

    function startFallbackMonitoring() {
        console.log('📊 Starting fallback monitoring');
        
        // Clear any existing interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        
        // Monitor via DOM and session storage
        checkInterval = setInterval(() => {
            try {
                // Check session storage for score
                const liveScore = sessionStorage.getItem('ninjaRunLiveScore');
                if (liveScore !== null) {
                    const score = parseInt(liveScore);
                    if (score > gameScore) {
                        gameScore = score;
                        console.log(`📊 Score updated from session: ${gameScore}`);
                    }
                }
                
                // Check for game completion flag
                const complete = sessionStorage.getItem('ninjaRunComplete');
                if (complete === 'true') {
                    const finalScore = sessionStorage.getItem('ninjaRunFinalScore');
                    if (finalScore !== null && !scoreSubmitted) {
                        console.log(`🎯 Game completion detected from session storage`);
                        window.ninjaRunComplete(parseInt(finalScore));
                        return;
                    }
                }
                
                // Try to find coins in DOM
                const domScore = findCoinScore();
                if (domScore > gameScore) {
                    gameScore = domScore;
                    console.log(`📊 Score updated from DOM: ${gameScore}`);
                    sessionStorage.setItem('ninjaRunLiveScore', gameScore.toString());
                }
                
                // Check for game over in DOM
                if (!gameEndDetected && gameScore > 0) {
                    const gameState = detectGameOver();
                    if (gameState.isGameOver) {
                        gameEndDetected = true;
                        console.log(`🎯 Game Over detected (fallback): ${gameState.reason}`);
                        setTimeout(() => {
                            if (!scoreSubmitted && gameScore > 0) {
                                window.ninjaRunComplete(gameScore);
                            }
                        }, CONFIG.scoreSubmitDelay);
                    }
                }
                
                // Auto-submit after 5 minutes of gameplay with score
                if (gameScore > 0 && !scoreSubmitted && gameStarted) {
                    scoreCheckCount++;
                    const elapsed = Date.now() - gameStartTime;
                    if (elapsed > CONFIG.maxGameTime) {
                        console.log('⏰ Auto-submit after max game time');
                        window.ninjaRunComplete(gameScore);
                    }
                }
                
            } catch (e) {}
        }, 500);
    }

    // ========================================
    // MANUAL SCORE SUBMISSION (For debugging)
    // ========================================

    window.submitNinjaRunScore = function(score) {
        const finalScore = parseInt(score) || gameScore || 0;
        console.log(`📤 Manual score submission: ${finalScore}`);
        window.ninjaRunComplete(finalScore);
    };

    window.getNinjaRunScore = function() {
        return gameScore;
    };

    window.getNinjaRunStatus = function() {
        return {
            score: gameScore,
            coins: gameScore,
            submitted: scoreSubmitted,
            started: gameStarted,
            ended: gameEndDetected,
            runtime: !!runtime,
            eventId: CONFIG.eventId,
            userId: CONFIG.userId,
            isDemo: CONFIG.isDemo,
            monitoring: !!checkInterval
        };
    };

    window.forceSubmitScore = function() {
        if (gameScore > 0 && !scoreSubmitted) {
            console.log('🔧 Force submitting score:', gameScore);
            window.ninjaRunComplete(gameScore);
            return true;
        }
        return false;
    };

    // ========================================
    // LISTEN FOR MESSAGES
    // ========================================

    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'NINJA_RUN_COMPLETE') {
            console.log('📨 Received completion message:', event.data);
            window.ninjaRunComplete(event.data.score || event.data.coins);
        }
        if (event.data && event.data.type === 'GET_NINJA_RUN_SCORE') {
            event.source.postMessage({
                type: 'NINJA_RUN_SCORE_RESPONSE',
                score: gameScore,
                coins: gameScore,
                submitted: scoreSubmitted
            }, '*');
        }
        if (event.data && event.data.type === 'NINJA_RUN_SUBMIT_SCORE') {
            window.submitNinjaRunScore(event.data.score || event.data.coins);
        }
        if (event.data && event.data.type === 'NINJA_RUN_FORCE_SUBMIT') {
            window.forceSubmitScore();
        }
    });

    // ========================================
    // EXPOSE FOR DEBUGGING
    // ========================================

    window.__ninjaDebug = {
        score: () => gameScore,
        coins: () => gameScore,
        status: () => window.getNinjaRunStatus(),
        submit: (score) => window.submitNinjaRunScore(score),
        force: () => window.forceSubmitScore(),
        config: CONFIG,
        findCoins: () => findCoinScore(),
        detectGameOver: () => detectGameOver()
    };

    // ========================================
    // CLEANUP
    // ========================================

    window.addEventListener('beforeunload', function() {
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        if (gameScore > 0 && !scoreSubmitted) {
            console.log('🔄 Page closing, submitting final score');
            window.ninjaRunComplete(gameScore);
        }
    });

    // ========================================
    // INIT
    // ========================================

    console.log('🚀 Ninja Run Bridge v3 (Coin Tracking) initializing...');

    // Start waiting for runtime
    waitForRuntime();

    console.log('✅ Ninja Run Bridge v3 ready');
    console.log('📊 For debugging, type: __ninjaDebug.status()');
    console.log('📊 To manually submit score: __ninjaDebug.submit(100)');
    console.log('📊 To force submit: __ninjaDebug.force()');
    console.log('🪙 Tracking coins only (not distance/score)');

})();
