/*******************************************************************************
 * PORTAL MULTI‑SESSION – Safe simultaneous logins across portals
 * Allows the same email to be used in different portals at the same time.
 * No DOM changes, no security loopholes, no breaking changes.
 ******************************************************************************/
(function() {
    'use strict';

    // === YOUR FIREBASE CONFIG (same for all portals) ===
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyDdXgTvZ6U1L7Z8X9Y0A1B2C3D4E5F6G7H8I9",
        authDomain: "bloomingkids-8f2e4.firebaseapp.com",
        projectId: "bloomingkids-8f2e4",
        storageBucket: "bloomingkids-8f2e4.appspot.com",
        messagingSenderId: "123456789012",
        appId: "1:123456789012:web:abc123def456ghi789jkl0"
    };

    // === Detect which portal we are on (based on URL path) ===
    function getCurrentPortal() {
        const path = window.location.pathname.toLowerCase();

        // Skip auth/login pages – they don't need multi‑session
        if (path.includes('-auth') || path.includes('student-login')) return null;

        if (path.includes('tutor')) return 'tutor';
        if (path.includes('parent')) return 'parent';
        if (path.includes('management')) return 'management';
        if (path.includes('admin')) return 'admin';
        if (path.includes('enrollment')) return 'enrollment';
        if (path === '/' || path.includes('index.html')) return 'assessment';

        return null; // not a portal page
    }

    const portal = getCurrentPortal();
    if (!portal) {
        console.log('🔓 Not a portal page – multi‑session disabled');
        return;
    }

    console.log(`🚀 Setting up multi‑session for ${portal} portal`);

    // === Wait for Firebase SDK to load, then initialise ===
    const maxAttempts = 50; // 5 seconds total
    let attempts = 0;
    const interval = setInterval(() => {
        if (window.firebase && window.firebase.initializeApp) {
            clearInterval(interval);
            setupFirebaseForPortal(portal);
        } else if (++attempts > maxAttempts) {
            clearInterval(interval);
            console.warn('Firebase not loaded – multi‑session aborted');
        }
    }, 100);

    function setupFirebaseForPortal(portalName) {
        // Create a named app for this portal (e.g., 'portal_tutor')
        const appId = `portal_${portalName}`;
        let app;
        try {
            app = firebase.initializeApp(FIREBASE_CONFIG, appId);
        } catch (e) {
            if (e.code === 'app/duplicate-app') {
                app = firebase.app(appId); // already exists
            } else {
                console.error('Firebase init error', e);
                return;
            }
        }

        // Ensure we use LOCAL persistence (so login survives page reload)
        app.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
            .catch(err => console.warn('Persistence error', err));

        // --- Patch global firebase.auth() to return THIS portal's auth ---
        const originalAuth = firebase.auth;
        firebase.auth = function(appArg) {
            // If called with no argument, return our portal's auth
            if (appArg === undefined) {
                return app.auth();
            }
            // Otherwise, call the original (allows access to other apps)
            return originalAuth.call(this, appArg);
        };

        // --- Also patch firestore if you use it ---
        if (firebase.firestore) {
            const originalFirestore = firebase.firestore;
            firebase.firestore = function(appArg) {
                if (appArg === undefined) {
                    return app.firestore();
                }
                return originalFirestore.call(this, appArg);
            };
        }

        // --- Optional: patch other services (storage, functions) similarly if needed ---
        // (Add only if your portals use them)

        console.log(`✅ Firebase now isolated for ${portalName} portal`);
    }
})();
