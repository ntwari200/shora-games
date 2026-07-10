// ========================================
// NINJA RUN - BRIDGE SCRIPT
// Connects Construct 2 game to Shora Games
// ========================================

(function() {
    'use strict';

    console.log('🏃 Ninja Run Bridge loaded');

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

    // ========================================
    // SCORE HANDLING
    // ========================================

    window.ninjaRunComplete = function(score) {
        console.log('🎮 Game Complete! Score:', score);
        
        if (scoreSubmitted) {
            console.log('⚠️ Score already submitted');
            return;
        }

        gameScore = score || 0;
        sendScoreToParent(gameScore);
    };

    function sendScoreToParent(score) {
        console.log('📤 Sending score to parent:', score);
        
        // Store in session storage
        sessionStorage.setItem('ninjaRunScore', score.toString());
        sessionStorage.setItem('ninjaRunPlayed', 'true');
        
        // Send to parent via postMessage
        if (window.parent && window.parent !== window) {
            try {
                window.parent.postMessage({
                    type: 'NINJA_RUN_COMPLETE',
                    score: score,
                    eventId: CONFIG.eventId,
                    userId: CONFIG.userId
                }, '*');
                console.log('✅ Score sent to parent via postMessage');
            } catch (e) {
                console.log('⚠️ Could not send to parent:', e);
            }
        }

        // Try calling parent function
        if (window.parent && window.parent.onNinjaRunComplete) {
            try {
                window.parent.onNinjaRunComplete(score, CONFIG.eventId, CONFIG.userId);
                console.log('✅ Score sent to parent via direct function');
            } catch (e) {
                console.log('⚠️ Could not call parent function:', e);
            }
        }

        scoreSubmitted = true;
        showCompletionMessage(score);
    }

    function showCompletionMessage(score) {
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

        // Auto-close after 4 seconds
        setTimeout(() => {
            if (overlay.parentNode) {
                overlay.style.opacity = '0';
                overlay.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                    window.close();
                }, 500);
            }
        }, 4000);
    }

    // ========================================
    // HOOK INTO CONSTRUCT 2 GAME
    // ========================================

    function waitForRuntime() {
        console.log('⏳ Waiting for Construct 2 runtime...');
        
        let attempts = 0;
        const maxAttempts = 30;
        
        const checkRuntime = setInterval(() => {
            attempts++;
            
            try {
                const canvas = document.getElementById('c2canvas');
                if (canvas && canvas.c2runtime) {
                    clearInterval(checkRuntime);
                    runtime = canvas.c2runtime;
                    console.log('✅ Construct 2 Runtime detected');
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

        // Hook into runtime tick
        const originalTick = runtime.tick;
        runtime.tick = function() {
            originalTick.call(this);
            
            try {
                // Look for score in game
                let currentScore = 0;
                
                // Check global variables
                if (runtime.globalVars) {
                    for (const key in runtime.globalVars) {
                        if (key.toLowerCase().includes('score') || key.toLowerCase().includes('distance')) {
                            const val = runtime.globalVars[key];
                            if (typeof val === 'number' && val > currentScore) {
                                currentScore = val;
                            }
                        }
                    }
                }
                
                // Check window variables
                const possibleVars = ['score', 'Score', 'playerScore', 'gameScore', 'distance', 'Distance'];
                for (const varName of possibleVars) {
                    if (typeof window[varName] !== 'undefined' && window[varName] > currentScore) {
                        currentScore = window[varName];
                    }
                }
                
                // Update score if changed
                if (currentScore > gameScore) {
                    gameScore = currentScore;
                    // Send live score update to parent
                    if (window.parent && window.parent !== window) {
                        try {
                            window.parent.postMessage({
                                type: 'NINJA_RUN_SCORE',
                                score: gameScore
                            }, '*');
                        } catch (e) {}
                    }
                    // Store in session storage for fallback
                    sessionStorage.setItem('ninjaRunLiveScore', gameScore.toString());
                }
                
                // Check for game over
                if (runtime.globalVars && runtime.globalVars['GameOver'] === true) {
                    if (gameScore > 0 && !scoreSubmitted) {
                        console.log('🎯 Game Over detected');
                        window.ninjaRunComplete(gameScore);
                    }
                }
            } catch (e) {
                // Ignore
            }
        };

        // Hook into trigger for game end detection
        const originalTrigger = runtime.trigger;
        runtime.trigger = function(method, inst, value) {
            const result = originalTrigger.call(this, method, inst, value);
            
            try {
                if (method && method.name) {
                    const methodName = method.name;
                    if (methodName === 'OnLayoutEnd' || 
                        methodName === 'OnDestroyed' ||
                        methodName.includes('GameOver') ||
                        methodName.includes('End')) {
                        if (gameScore > 0 && !scoreSubmitted) {
                            console.log('🎯 Game end detected via trigger:', methodName);
                            window.ninjaRunComplete(gameScore);
                        }
                    }
                }
            } catch (e) {
                // Ignore
            }
            
            return result;
        };

        gameStarted = true;
        console.log('✅ Game hook installed');
    }

    // ========================================
    // FALLBACK MONITORING
    // ========================================

    function startFallbackMonitoring() {
        console.log('📊 Starting fallback monitoring');
        
        let lastScore = 0;
        let noChangeCount = 0;
        
        checkInterval = setInterval(() => {
            try {
                // Check if game is still running
                if (runtime && runtime.globalVars) {
                    // Check for game over
                    if (runtime.globalVars['GameOver'] === true) {
                        if (gameScore > 0 && !scoreSubmitted) {
                            window.ninjaRunComplete(gameScore);
                        }
                        return;
                    }
                    
                    // Look for score updates
                    for (const key in runtime.globalVars) {
                        if (key.toLowerCase().includes('distance') || key.toLowerCase().includes('score')) {
                            const val = runtime.globalVars[key];
                            if (typeof val === 'number' && val > gameScore) {
                                gameScore = val;
                                sessionStorage.setItem('ninjaRunLiveScore', gameScore.toString());
                            }
                        }
                    }
                }
                
                // If score hasn't changed for a while and game seems to have ended
                if (gameScore === lastScore) {
                    noChangeCount++;
                    if (noChangeCount > 30 && gameScore > 0 && !scoreSubmitted && gameStarted) {
                        // Check if game is still responsive
                        if (runtime && runtime.isRunning) {
                            noChangeCount = 0;
                        } else {
                            console.log('🎯 Game ended (score unchanged, runtime stopped)');
                            window.ninjaRunComplete(gameScore);
                        }
                    }
                } else {
                    lastScore = gameScore;
                    noChangeCount = 0;
                }
            } catch (e) {
                // Ignore
            }
        }, 100);

        // Timeout after 2 minutes
        setTimeout(() => {
            if (checkInterval) {
                clearInterval(checkInterval);
                if (gameScore > 0 && !scoreSubmitted) {
                    console.log('⏰ Game timeout, submitting score');
                    window.ninjaRunComplete(gameScore);
                }
            }
        }, 120000);
    }

    // ========================================
    // MANUAL SCORE SUBMISSION
    // ========================================

    window.submitNinjaRunScore = function(score) {
        window.ninjaRunComplete(score || gameScore);
    };

    window.getNinjaRunScore = function() {
        return gameScore;
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
                score: gameScore
            }, '*');
        }
    });

    // ========================================
    // CLEANUP
    // ========================================

    window.addEventListener('beforeunload', function() {
        if (checkInterval) {
            clearInterval(checkInterval);
        }
    });

    // ========================================
    // INIT
    // ========================================

    console.log('🚀 Ninja Run Bridge initializing...');
    console.log(`📋 Event ID: ${CONFIG.eventId}`);
    console.log(`👤 User ID: ${CONFIG.userId}`);

    // Start waiting for runtime
    waitForRuntime();

    console.log('✅ Ninja Run Bridge ready');

})();
