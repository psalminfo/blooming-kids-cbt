/*******************************************************************************
 * PORTAL PROTECTOR - FIXED VERSION (No Auth Page Interference)
 ******************************************************************************/
// === SKIP AUTH PAGES ===
function isAuthPage() {
    const path = window.location.pathname.toLowerCase();
    const authPages = [
        'tutor-auth', 'parent-auth', 'management-auth',
        'admin-auth', 'enrollment-auth', 'student-login',
        'enrollment', 'enrollment-portal'
    ];
    
    return authPages.some(page => path.includes(page));
}

// Exit immediately if auth page
if (isAuthPage()) {
    console.log('🔐 Auth page - portal protector disabled');
    return;
}
(function() {
    'use strict';
    
    // === CHECK IF WE'RE ON AN AUTH PAGE ===
    function isAuthPage() {
        const path = window.location.pathname.toLowerCase();
        return path.includes('-auth') || path.includes('student-login');
    }
    
    // If auth page, DO NOT RUN PORTAL PROTECTOR
    if (isAuthPage()) {
        console.log('🔐 Auth page detected - portal protector disabled');
        return; // EXIT COMPLETELY
    }
    
    // === PORTAL CONFIGURATION ===
    const PORTAL_CONFIG = Object.freeze({
        'tutor': Object.freeze({ file: 'tutor.html', authFile: 'tutor-auth.html' }),
        'parent': Object.freeze({ file: 'parent.html', authFile: 'parent-auth.html' }),
        'management': Object.freeze({ file: 'management.html', authFile: 'management-auth.html' }),
        'admin': Object.freeze({ file: 'admin.html', authFile: 'admin-auth.html' }),
        'enrollment': Object.freeze({ file: 'enrollment.html', authFile: 'enrollment-auth.html' }),
        'assessment': Object.freeze({ file: 'index.html', authFile: 'index.html' })
    });
    
    // === DETECT CURRENT PORTAL ===
    function detectPortal() {
        const path = window.location.pathname.toLowerCase();
        for (const portal in PORTAL_CONFIG) {
            const portalFile = PORTAL_CONFIG[portal].file.toLowerCase();
            if (path.includes(portal) || path.includes(portalFile)) {
                return portal;
            }
        }
        return 'assessment';
    }
    
    const CURRENT_PORTAL = detectPortal();
    
    // === SIMPLE TRACKING (No CSS Injection) ===
    function trackEmailPortal(email, portal) {
        try {
            const portalTracking = JSON.parse(localStorage.getItem('email_portal_tracking') || '{}');
            
            if (!portalTracking[email]) {
                portalTracking[email] = [];
            }
            
            if (!portalTracking[email].includes(portal)) {
                portalTracking[email].push(portal);
            }
            
            // Keep only last 3 portals
            if (portalTracking[email].length > 3) {
                portalTracking[email].shift();
            }
            
            localStorage.setItem('email_portal_tracking', JSON.stringify(portalTracking));
            localStorage.setItem(`last_portal_${email}`, portal);
            
            console.log(`📝 ${email} in portals: ${portalTracking[email].join(', ')}`);
        } catch (e) {
            console.error('Tracking error:', e);
        }
    }
    
    // === MINIMAL FIREBASE PROTECTION (No UI Changes) ===
    function setupPortalProtection() {
        if (!window.firebase || !window.firebase.auth) return;
        
        const auth = window.firebase.auth();
        const originalOnAuthStateChanged = auth.onAuthStateChanged.bind(auth);
        
        // Override auth state listener
        auth.onAuthStateChanged = function(callback, errorCallback, completedCallback) {
            return originalOnAuthStateChanged((user) => {
                if (user && user.email) {
                    // Simple tracking - NO UI CHANGES
                    trackEmailPortal(user.email, CURRENT_PORTAL);
                    
                    // Add minimal portal info
                    Object.defineProperty(user, '_portalInfo', {
                        value: { currentPortal: CURRENT_PORTAL },
                        writable: false
                    });
                }
                
                if (callback) callback(user);
            }, errorCallback, completedCallback);
        };
        
        console.log(`🔒 Portal protection active for ${CURRENT_PORTAL}`);
    }
    
    // === INITIALIZE ===
    window.addEventListener('load', function() {
        // Wait for Firebase
        const checkInterval = setInterval(() => {
            if (window.firebase && window.firebase.auth) {
                clearInterval(checkInterval);
                setupPortalProtection();
            }
        }, 100);
        
        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkInterval), 5000);
    });
    
    // === SIMPLE PORTAL SWITCHING ===
    window.switchToPortal = function(portalName) {
        const portal = PORTAL_CONFIG[portalName];
        if (portal) {
            window.location.href = `/${portal.file}`;
        }
    };
    
    console.log(`🚀 Portal protection loaded for ${CURRENT_PORTAL}`);
})();
