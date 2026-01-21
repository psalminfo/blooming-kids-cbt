/*******************************************************************************
 * ULTIMATE PORTAL PROTECTOR - ONE FILE SOLUTION
 * Allows same email across all portals, no restrictions, no bouncing
 ******************************************************************************/

(function() {
    'use strict';
    
    // Portal configuration - ONLY EDIT THIS SECTION
    const PORTAL_CONFIG = {
        'tutor': { file: 'tutor.html', authFile: 'tutor-auth.html' },
        'parent': { file: 'parent.html', authFile: 'parent-auth.html' },
        'management': { file: 'management.html', authFile: 'management-auth.html' },
        'admin': { file: 'admin.html', authFile: 'admin-auth.html' },
        'enrollment': { file: 'enrollment.html', authFile: 'enrollment-auth.html' },
        'assessment': { file: 'index.html', authFile: 'index.html' }
    };
    
    // Detect current portal
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
    
    // Track which portals an email is logged into
    function trackEmailPortal(email, portal) {
        const portalTracking = JSON.parse(localStorage.getItem('email_portal_tracking') || '{}');
        
        if (!portalTracking[email]) {
            portalTracking[email] = [];
        }
        
        if (!portalTracking[email].includes(portal)) {
            portalTracking[email].push(portal);
        }
        
        if (portalTracking[email].length > 5) {
            portalTracking[email] = portalTracking[email].slice(-5);
        }
        
        localStorage.setItem('email_portal_tracking', JSON.stringify(portalTracking));
        localStorage.setItem(`last_portal_${email}`, portal);
        
        console.log(`📝 ${email} now active in portals: ${portalTracking[email].join(', ')}`);
    }
    
    // Check if email is already in another portal
    function checkOtherPortals(email, currentPortal) {
        const portalTracking = JSON.parse(localStorage.getItem('email_portal_tracking') || '{}');
        
        if (portalTracking[email]) {
            const otherPortals = portalTracking[email].filter(p => p !== currentPortal);
            if (otherPortals.length > 0) {
                return otherPortals;
            }
        }
        return [];
    }
    
    // Intercept Firebase auth
    function protectFirebaseAuth() {
        if (!window.firebase || !window.firebase.auth) return;
        
        const originalAuth = window.firebase.auth;
        
        // Store original methods
        const originalSignIn = originalAuth.Auth.prototype.signInWithEmailAndPassword;
        const originalSignOut = originalAuth.Auth.prototype.signOut;
        const originalOnAuthStateChanged = originalAuth.Auth.prototype.onAuthStateChanged;
        
        // Override signIn - ALLOW ANY EMAIL
        originalAuth.Auth.prototype.signInWithEmailAndPassword = function(email, password) {
            return originalSignIn.call(this, email, password).then(userCredential => {
                trackEmailPortal(email, CURRENT_PORTAL);
                showPortalWelcome(email, CURRENT_PORTAL);
                return userCredential;
            });
        };
        
        // Override signOut - ONLY CLEAR THIS PORTAL
        originalAuth.Auth.prototype.signOut = function() {
            const user = this.currentUser;
            if (user) {
                const email = user.email;
                const portalTracking = JSON.parse(localStorage.getItem('email_portal_tracking') || '{}');
                if (portalTracking[email]) {
                    portalTracking[email] = portalTracking[email].filter(p => p !== CURRENT_PORTAL);
                    if (portalTracking[email].length === 0) {
                        delete portalTracking[email];
                    }
                    localStorage.setItem('email_portal_tracking', JSON.stringify(portalTracking));
                }
            }
            return originalSignOut.call(this);
        };
        
        // Override auth state listener
        originalAuth.Auth.prototype.onAuthStateChanged = function(callback, errorCallback, completedCallback) {
            return originalOnAuthStateChanged.call(this, (user) => {
                if (user) {
                    const email = user.email;
                    user._portalInfo = {
                        currentPortal: CURRENT_PORTAL,
                        allPortals: JSON.parse(localStorage.getItem('email_portal_tracking') || '{}')[email] || [],
                        isMultiPortal: false
                    };
                    
                    const otherPortals = checkOtherPortals(email, CURRENT_PORTAL);
                    if (otherPortals.length > 0) {
                        user._portalInfo.isMultiPortal = true;
                        user._portalInfo.otherPortals = otherPortals;
                        showMultiPortalNotification(email, CURRENT_PORTAL, otherPortals);
                    }
                }
                if (callback) callback(user);
            }, errorCallback, completedCallback);
        };
        
        console.log(`🔒 Portal protector activated for ${CURRENT_PORTAL}`);
    }
    
    // Show welcome message
    function showPortalWelcome(email, portal) {
        const existing = document.getElementById('portal-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.id = 'portal-notification';
        notification.innerHTML = `
            <style>
                #portal-notification {
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: linear-gradient(135deg, #4CAF50, #2E7D32);
                    color: white;
                    padding: 12px 16px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 999999;
                    max-width: 350px;
                    animation: slideIn 0.3s ease;
                    border-left: 4px solid #fff;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                .portal-notification-close {
                    background: transparent;
                    color: white;
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    font-size: 18px;
                    cursor: pointer;
                    border: none;
                }
            </style>
            <button class="portal-notification-close" onclick="this.parentElement.remove()">×</button>
            <div style="font-weight: 600; margin-bottom: 5px;">👋 Welcome to ${portal.toUpperCase()} Portal</div>
            <div style="font-size: 13px;">
                Signed in as <span style="color: #ffeb3b;">${email}</span>
                <div style="margin-top: 5px; font-size: 12px; opacity: 0.9;">
                    You can use this email in other portals too!
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 5000);
    }
    
    // Show notification about other portals
    function showMultiPortalNotification(email, currentPortal, otherPortals) {
        const notification = document.createElement('div');
        notification.id = 'multi-portal-notification';
        notification.innerHTML = `
            <style>
                #multi-portal-notification {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    background: linear-gradient(135deg, #2196F3, #0D47A1);
                    color: white;
                    padding: 15px;
                    border-radius: 10px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
                    z-index: 999999;
                    max-width: 400px;
                    animation: slideUp 0.3s ease;
                }
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
                .multi-portal-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    margin-top: 12px;
                }
                .portal-switch-btn {
                    padding: 6px 12px;
                    background: rgba(255,255,255,0.2);
                    color: white;
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 20px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: all 0.2s;
                }
                .portal-switch-btn:hover {
                    background: white;
                    color: #2196F3;
                }
            </style>
            <div style="font-weight: 600; margin-bottom: 8px;">🌐 Multi-Portal Access</div>
            <div style="font-size: 13px; margin-bottom: 10px;">
                <span style="color: #ffeb3b;">${email}</span> is also logged into:
            </div>
            <div class="multi-portal-buttons">
                ${otherPortals.map(portal => `
                    <button class="portal-switch-btn" onclick="switchToPortal('${portal}')">
                        ${portal.toUpperCase()}
                    </button>
                `).join('')}
                <button class="portal-switch-btn" onclick="this.parentElement.parentElement.remove()" 
                        style="background: rgba(255,255,255,0.1);">
                    Dismiss
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        setTimeout(() => {
            if (notification.parentElement) notification.remove();
        }, 15000);
    }
    
    // Global function to switch portals
    window.switchToPortal = function(portalName) {
        const portal = PORTAL_CONFIG[portalName];
        if (portal) {
            window.location.href = `/${portal.file}`;
        }
    };
    
    // Initialize
    window.addEventListener('load', function() {
        const checkFirebase = setInterval(() => {
            if (window.firebase && window.firebase.auth) {
                clearInterval(checkFirebase);
                protectFirebaseAuth();
                
                if (window.firebase.auth().currentUser) {
                    const user = window.firebase.auth().currentUser;
                    trackEmailPortal(user.email, CURRENT_PORTAL);
                    
                    const otherPortals = checkOtherPortals(user.email, CURRENT_PORTAL);
                    if (otherPortals.length > 0) {
                        setTimeout(() => {
                            showMultiPortalNotification(user.email, CURRENT_PORTAL, otherPortals);
                        }, 2000);
                    }
                }
            }
        }, 500);
    });
    
    console.log(`🚀 Ultimate Portal Protector loaded for ${CURRENT_PORTAL}`);
})();
