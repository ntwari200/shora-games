/**
 * ========================================
 * SHORA GAMES - MAINTENANCE CHECK
 * This script runs on EVERY page
 * ========================================
 */

// Check if we're already on the maintenance page
function isMaintenancePage() {
    return window.location.pathname.includes('maintenance.html');
}

// Check maintenance status from Firebase
function checkMaintenanceStatus() {
    // Import Firebase dynamically
    import('https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js')
        .then(({ initializeApp }) => {
            import('https://www.gstatic.com/firebasejs/10.10.0/firebase-database.js')
                .then(({ getDatabase, ref, onValue }) => {
                    const firebaseConfig = {
                        apiKey: "AIzaSyDTcM9aUFhOpJTdQTSZAF_1XMEt6GL48Hs",
                        authDomain: "shora-games.firebaseapp.com",
                        projectId: "shora-games",
                        databaseURL: "https://shora-games-default-rtdb.firebaseio.com/"
                    };

                    const app = initializeApp(firebaseConfig);
                    const db = getDatabase(app);
                    const maintenanceRef = ref(db, 'maintenance');

                    onValue(maintenanceRef, (snapshot) => {
                        try {
                            const data = snapshot.val();
                            
                            // If we're already on maintenance page, don't redirect
                            if (isMaintenancePage()) {
                                return;
                            }

                            // If maintenance is enabled, redirect
                            if (data && data.enabled === true) {
                                console.log('🛠️ Maintenance mode is ON - Redirecting to maintenance page');
                                window.location.href = '/maintenance.html';
                            }
                        } catch (error) {
                            console.error('❌ Error checking maintenance:', error);
                        }
                    });
                });
        })
        .catch(error => {
            console.error('❌ Failed to load Firebase:', error);
        });
}

// Run the check immediately
checkMaintenanceStatus();
