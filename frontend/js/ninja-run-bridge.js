// ========================================
// NINJA RUN - BRIDGE SCRIPT
// Connects Construct 2 game to Shora Games Platform
// Location: frontend/js/ninja-run-bridge.js
// ========================================

(function() {
    'use strict';

    console.log('🏃 Ninja Run Bridge v2 loaded');

    // ========================================
    // CONFIG
    // ========================================

    const CONFIG = {
        eventId: getParam('event'),
        userId: getParam('user'),
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
    let scoreCheckCount = 0;
    let lastKnownScore = 0;
    let gameEndDetected = false;

    console.log(`📋 Event ID: ${CONFIG.eventId}`);
    console.log(`👤 User ID: ${CONFIG.userId}`);

    // ========================================
    // SCORE HANDLING
    // ========================================

    window.ninjaRunComplete = function(score) {
        console.log('🎮 Game Complete! Score:', score);
        
        if (scoreSubmitted) {
            console.log('⚠️ Score already submitted');
            return;
        }

        const finalScore = parseInt(score) || gameScore || 0;
        gameScore = finalScore;
        
        console.log(`📊 Final Score: ${finalScore}`);
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
        
        // Also store in localStorage as backup
        try {
            localStorage.setItem('ninjaRunScore_' + CONFIG.eventId, finalScore.toString());
            localStorage.setItem('ninjaRunPlayed_' + CONFIG.userId, 'true');
        } catch (e) {}
        
        // Send to parent via postMessage
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({
                    type: 'NINJA_RUN_COMPLETE',
                    score: finalScore,
                    eventId: CONFIG.eventId,
                    userId: CONFIG.userId,
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
        showCompletionMessage(finalScore);
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
                border: 2px solid #00BFFF;
                border-radius: 20px;
                padding: 30px 40px;
                text-align: center;
                max-width: 400px;
                box-shadow: 0 0 60px rgba(0, 191, 255, 0.2);
            ">
                <div style="font-size: 3.5rem; margin-bottom: 8px;">🏆</div>
                <h2 style="
                    font-family: 'Orbitron', monospace;
                    color: #FFD700;
                    font-size: 1.3rem;
                    margin-bottom: 6px;
                ">Game Complete!</h2>
                <div style="
                    font-size: 2.5rem;
                    color: #00E676;
                    font-weight: 700;
                    margin: 8px 0;
                ">${score}</div>
                <div style="color: #A7B5C5; font-size: 0.8rem;">points</div>
                <div style="margin-top: 12px; font-size: 0.7rem; color: #A7B5C5;">
                    <i class="fas fa-sync fa-spin"></i> Submitting score...
                </div>
                <button onclick="window.close()" style="
                    margin-top: 20px;
                    background: linear-gradient(135deg, #00BFFF, #6C63FF);
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
                    Close & View Rankings
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

        // Auto-close after 5 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                    window.close();
                }, 500);
            }
        }, 5000);
    }

    // ========================================
    // HOOK INTO CONSTRUCT 2 GAME
    // ========================================

    function waitForRuntime() {
        console.log('⏳ Waiting for Construct 2 runtime...');
        
        let attempts = 0;
        const maxAttempts = 50;
        
        const checkRuntime = setInterval(() => {
            attempts++;
            
            try {
                // Try multiple ways to find the runtime
                const canvas = document.getElementById('c2canvas');
                if (canvas && canvas.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = canvas.c2runtime;
                    console.log('✅ Construct 2 Runtime detected');
                    hookIntoGame(runtime);
                    return;
                }
                
                // Check for global runtime
                if (window.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = window.c2runtime;
                    console.log('✅ Construct 2 Runtime detected via window');
                    hookIntoGame(runtime);
                    return;
                }
                
                // Check if game is already running
                if (window.c2canvas && window.c2canvas.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = window.c2canvas.c2runtime;
                    console.log('✅ Construct 2 Runtime detected via c2canvas');
                    hookIntoGame(runtime);
                    return;
                }
            } catch (e) {
                // Ignore
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkRuntime);
                console.log('⚠️ Runtime detection timed out, using fallback');
                startFallbackMonitoring();
            }
        }, 500);
    }

    function hookIntoGame(runtime) {
        console.log('🔗 Hooking into game...');

        // ========================================
        // METHOD 1: Monitor global variables
        // ========================================
        
        const originalTick = runtime.tick;
        runtime.tick = function() {
            originalTick.call(this);
            
            try {
                let currentScore = 0;
                
                // 1. Check runtime global variables
                if (runtime.globalVars) {
                    for (const key in runtime.globalVars) {
                        const lowerKey = key.toLowerCase();
                        if (lowerKey.includes('score') || 
                            lowerKey.includes('distance') || 
                            lowerKey.includes('points') ||
                            lowerKey === 'score' ||
                            lowerKey === 'distance') {
                            const val = runtime.globalVars[key];
                            if (typeof val === 'number' && val > currentScore) {
                                currentScore = val;
                            }
                        }
                    }
                }
                
                // 2. Check window variables
                const windowVars = ['score', 'Score', 'playerScore', 'gameScore', 'distance', 'Distance', 'points', 'Points'];
                for (const varName of windowVars) {
                    if (typeof window[varName] !== 'undefined') {
                        const val = window[varName];
                        if (typeof val === 'number' && val > currentScore) {
                            currentScore = val;
                        }
                    }
                }
                
                // 3. Check for score elements in DOM
                try {
                    const scoreElements = document.querySelectorAll('[data-score], .score, #score, [id*="score"]');
                    for (const el of scoreElements) {
                        const text = el.textContent || el.innerText || '';
                        const num = parseInt(text.replace(/[^0-9]/g, ''));
                        if (!isNaN(num) && num > currentScore) {
                            currentScore = num;
                        }
                    }
                } catch (e) {}
                
                // Update score if changed
                if (currentScore > gameScore) {
                    gameScore = currentScore;
                    console.log(`📊 Score updated: ${gameScore}`);
                    
                    try {
                        if (window.parent && window.parent !== window) {
                            window.parent.postMessage({
                                type: 'NINJA_RUN_SCORE',
                                score: gameScore
                            }, '*');
                        }
                    } catch (e) {}
                    
                    sessionStorage.setItem('ninjaRunLiveScore', gameScore.toString());
                }
                
                // Check for game over
                if (runtime.globalVars) {
                    const gameOverKeys = ['GameOver', 'gameOver', 'GAME_OVER', 'end', 'End', 'finished', 'Finished'];
                    for (const key of gameOverKeys) {
                        if (runtime.globalVars[key] === true || runtime.globalVars[key] === 1) {
                            if (gameScore > 0 && !scoreSubmitted) {
                                console.log(`🎯 Game Over detected (${key})`);
                                gameEndDetected = true;
                                window.ninjaRunComplete(gameScore);
                                return;
                            }
                        }
                    }
                }
                
            } catch (e) {}
        };

        // ========================================
        // METHOD 2: Monitor triggers for game end
        // ========================================
        
        const originalTrigger = runtime.trigger;
        runtime.trigger = function(method, inst, value) {
            const result = originalTrigger.call(this, method, inst, value);
            
            try {
                if (method && method.name) {
                    const methodName = method.name;
                    const endKeywords = ['End', 'GameOver', 'Finish', 'Complete', 'Destroy', 'Die', 'Dead', 'Over'];
                    
                    for (const keyword of endKeywords) {
                        if (methodName.includes(keyword)) {
                            if (gameScore > 0 && !scoreSubmitted) {
                                console.log(`🎯 Game end detected via trigger: ${methodName}`);
                                gameEndDetected = true;
                                window.ninjaRunComplete(gameScore);
                                break;
                            }
                        }
                    }
                }
            } catch (e) {}
            
            return result;
        };

        // ========================================
        // METHOD 3: Direct score access
        // ========================================
        
        try {
            if (runtime.layouts) {
                for (const layoutName in runtime.layouts) {
                    const layout = runtime.layouts[layoutName];
                    if (layout && layout.globalVars) {
                        for (const key in layout.globalVars) {
                            if (key.toLowerCase().includes('score') || key.toLowerCase().includes('distance')) {
                                const val = layout.globalVars[key];
                                if (typeof val === 'number' && val > gameScore) {
                                    gameScore = val;
                                    console.log(`📊 Found score in layout: ${val}`);
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {}

        gameStarted = true;
        console.log('✅ Game hook installed');
        console.log(`📊 Initial Score: ${gameScore}`);
    }

    // ========================================
    // FALLBACK MONITORING
    // ========================================

    function startFallbackMonitoring() {
        console.log('📊 Starting fallback monitoring');
        
        let noChangeCount = 0;
        let lastCheckedScore = 0;
        
        checkInterval = setInterval(() => {
            try {
                // Check session storage for score updates from game
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
                
                // Check if game is still running
                if (runtime && runtime.globalVars) {
                    // Check for game over
                    if (runtime.globalVars['GameOver'] === true || runtime.globalVars['gameOver'] === true) {
                        if (gameScore > 0 && !scoreSubmitted) {
                            console.log('🎯 Game Over detected in fallback');
                            window.ninjaRunComplete(gameScore);
                            return;
                        }
                    }
                    
                    // Look for score
                    for (const key in runtime.globalVars) {
                        const lowerKey = key.toLowerCase();
                        if (lowerKey.includes('score') || lowerKey.includes('distance')) {
                            const val = runtime.globalVars[key];
                            if (typeof val === 'number' && val > gameScore) {
                                gameScore = val;
                                sessionStorage.setItem('ninjaRunLiveScore', gameScore.toString());
                            }
                        }
                    }
                }
                
                // If score hasn't changed and game seems to be done
                if (gameScore === lastCheckedScore) {
                    noChangeCount++;
                    if (noChangeCount > 30 && gameScore > 0 && !scoreSubmitted && gameStarted) {
                        if (runtime && runtime.isRunning !== undefined && !runtime.isRunning) {
                            console.log('🎯 Game ended (runtime stopped)');
                            window.ninjaRunComplete(gameScore);
                        }
                    }
                } else {
                    lastCheckedScore = gameScore;
                    noChangeCount = 0;
                }
                
                // Auto-submit after 60 seconds of gameplay with score > 0 (fallback)
                if (gameScore > 0 && !scoreSubmitted && gameStarted) {
                    scoreCheckCount++;
                    if (scoreCheckCount > 120) {
                        console.log('⏰ Auto-submit after timeout');
                        window.ninjaRunComplete(gameScore);
                    }
                }
                
            } catch (e) {
                // Ignore
            }
        }, 500);

        // Timeout after 3 minutes
        setTimeout(() => {
            if (checkInterval) {
                clearInterval(checkInterval);
                if (gameScore > 0 && !scoreSubmitted) {
                    console.log('⏰ Final timeout, submitting score');
                    window.ninjaRunComplete(gameScore);
                }
            }
        }, 180000);
    }

    // ========================================
    // MANUAL SCORE SUBMISSION
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
            submitted: scoreSubmitted,
            started: gameStarted,
            ended: gameEndDetected,
            runtime: !!runtime,
            eventId: CONFIG.eventId,
            userId: CONFIG.userId
        };
    };

    // ========================================
    // LISTEN FOR MESSAGES
    // ========================================

    window.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'NINJA_RUN_COMPLETE') {
            console.log('📨 Received message:', event.data);
            window.ninjaRunComplete(event.data.score);
        }
        if (event.data && event.data.type === 'GET_NINJA_RUN_SCORE') {
            event.source.postMessage({
                type: 'NINJA_RUN_SCORE_RESPONSE',
                score: gameScore,
                submitted: scoreSubmitted
            }, '*');
        }
        if (event.data && event.data.type === 'NINJA_RUN_SUBMIT_SCORE') {
            window.submitNinjaRunScore(event.data.score);
        }
    });

    // ========================================
    // EXPOSE FOR DEBUGGING
    // ========================================

    window.__ninjaDebug = {
        score: () => gameScore,
        status: () => ({
            score: gameScore,
            submitted: scoreSubmitted,
            started: gameStarted,
            runtime: !!runtime,
            ended: gameEndDetected
        }),
        submit: (score) => window.submitNinjaRunScore(score),
        config: CONFIG
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

    console.log('🚀 Ninja Run Bridge v2 initializing...');

    // Start waiting for runtime
    waitForRuntime();

    console.log('✅ Ninja Run Bridge v2 ready');
    console.log('📊 For debugging, type: __ninjaDebug.status()');
    console.log('📊 To manually submit score: __ninjaDebug.submit(100)');

})();
