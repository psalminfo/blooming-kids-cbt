/*******************************************************************************
 * PORTAL SESSIONS - MINIMAL VERSION
 * Tracks portal sessions WITHOUT modifying pages or redirects
 * SAFE: No DOM changes, no redirects, no style injection
 ******************************************************************************/

(function() {
    'use strict';
    
    console.log('🔐 Minimal portal session tracker loaded');
    
    // === CONFIG ===
    const CONFIG = {
        SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
        CLEANUP_INTERVAL: 5 * 60 * 1000,      // Clean every 5 minutes
        MAX_SESSIONS_PER_EMAIL: 5
    };
    
    // === SIMPLE SESSION TRACKING ===
    function trackPortalSession(email, portal) {
        try {
            // Get current sessions
            const sessions = JSON.parse(localStorage.getItem('portal_sessions') || '{}');
            
            if (!sessions[email]) {
                sessions[email] = [];
            }
            
            // Add current portal with timestamp
            const sessionData = {
                portal: portal,
                timestamp: Date.now(),
                page: window.location.pathname
            };
            
            // Remove duplicate portals for same email
            sessions[email] = sessions[email].filter(s => s.portal !== portal);
            
            // Add new session
            sessions[email].push(sessionData);
            
            // Limit sessions per email
            if (sessions[email].length > CONFIG.MAX_SESSIONS_PER_EMAIL) {
                sessions[email].shift(); // Remove oldest
            }
            
            // Save
            localStorage.setItem('portal_sessions', JSON.stringify(sessions));
            
            console.log(`📝 Session tracked: ${email} → ${portal}`);
            console.log(`   Active portals: ${sessions[email].map(s => s.portal).join(', ')}`);
            
            return sessions[email];
        } catch (error) {
            console.error('Session tracking error:', error);
            return [];
        }
    }
    
    // === CLEAN OLD SESSIONS ===
    function cleanupOldSessions() {
        try {
            const sessions = JSON.parse(localStorage.getItem('portal_sessions') || '{}');
            const now = Date.now();
            let cleaned = false;
            
            for (const email in sessions) {
                const activeSessions = sessions[email].filter(s => 
                    now - s.timestamp < CONFIG.SESSION_TIMEOUT
                );
                
                if (activeSessions.length !== sessions[email].length) {
                    sessions[email] = activeSessions;
                    cleaned = true;
                }
                
                // Remove email if no active sessions
                if (activeSessions.length === 0) {
                    delete sessions[email];
                }
            }
            
            if (cleaned) {
                localStorage.setItem('portal_sessions', JSON.stringify(sessions));
                console.log('🧹 Cleaned old sessions');
            }
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }
    
    // === GET CURRENT PORTAL ===
    function getCurrentPortal() {
        const path = window.location.pathname.toLowerCase();
        
        if (path.includes('tutor') && !path.includes('tutor-auth')) return 'tutor';
        if (path.includes('parent') && !path.includes('parent-auth')) return 'parent';
        if (path.includes('management') && !path.includes('management-auth')) return 'management';
        if (path.includes('admin') && !path.includes('admin-auth')) return 'admin';
        if (path.includes('enrollment') && !path.includes('enrollment-auth')) return 'enrollment';
        if (path === '/' || path.includes('index.html')) return 'assessment';
        
        return null;
    }
    
    // === MAIN ===
    function init() {
        const currentPortal = getCurrentPortal();
        
        if (!currentPortal) {
            console.log('🔐 Not a portal page - session tracking disabled');
            return;
        }
        
        console.log(`📍 Current portal: ${currentPortal}`);
        
        // Set up periodic cleanup
        setInterval(cleanupOldSessions, CONFIG.CLEANUP_INTERVAL);
        
        // Initial cleanup
        cleanupOldSessions();
        
        // Listen for Firebase auth changes (if Firebase exists)
        if (window.firebase && window.firebase.auth) {
            setTimeout(() => {
                const auth = window.firebase.auth();
                
                auth.onAuthStateChanged((user) => {
                    if (user && user.email) {
                        const sessions = trackPortalSession(user.email, currentPortal);
                        
                        // Log multi-portal status
                        if (sessions.length > 1) {
                            console.log(`🌐 ${user.email} is active in ${sessions.length} portals`);
                            console.log(`   Portals: ${sessions.map(s => s.portal).join(', ')}`);
                        }
                    }
                });
            }, 1000);
        } else {
            console.log('ℹ️ Firebase not detected - basic session tracking only');
        }
        
        // Expose simple API
        window.PortalSessions = {
            getCurrentPortal: () => currentPortal,
            getSessions: (email) => {
                const sessions = JSON.parse(localStorage.getItem('portal_sessions') || '{}');
                return sessions[email] || [];
            },
            clearSessions: (email) => {
                const sessions = JSON.parse(localStorage.getItem('portal_sessions') || '{}');
                if (email && sessions[email]) {
                    delete sessions[email];
                    localStorage.setItem('portal_sessions', JSON.stringify(sessions));
                    return true;
                }
                return false;
            }
        };
    }
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
