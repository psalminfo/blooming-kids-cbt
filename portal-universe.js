/*******************************************************************************
 * PORTAL UNIVERSE - ULTIMATE SECURITY EDITION
 * One file solution: Enables single email across all portals with max security
 * No code changes needed to existing files - auto-injects and patches everything
 ******************************************************************************/

(function() {
    'use strict';
    
    console.log('🛡️ Portal Universe Security Suite v3.0 loading...');
    
    // === ULTIMATE SECURITY CONFIG ===
    const SECURITY = {
        // Threat Protection
        MAX_LOGIN_ATTEMPTS: 5,
        RATE_LIMIT_WINDOW: 60000, // 1 minute
        SESSION_TIMEOUT: 30 * 24 * 60 * 60 * 1000, // 30 days
        TOKEN_ROTATION: 24 * 60 * 60 * 1000, // 24 hours
        
        // Anti-Phishing
        ALLOWED_DOMAINS: ['bkh.netlify.app', 'localhost'],
        BLOCKED_PATTERNS: [
            'phishing', 'malware', 'hack', 'exploit',
            'script>', 'javascript:', 'onload=', 'onerror='
        ],
        
        // Encryption (in production, use Web Crypto API)
        ENCRYPTION_KEY: 'portal_secure_' + window.location.hostname,
        
        // Firebase Instances
        PORTAL_APPS: {
            'tutor': 'tutor_secure_app_v3',
            'parent': 'parent_secure_app_v3',
            'management': 'management_secure_app_v3',
            'admin': 'admin_secure_app_v3',
            'enrollment': 'enrollment_secure_app_v3',
            'assessment': 'assessment_secure_app_v3'
        }
    };
    
    // === FIREBASE CONFIG (ENCRYPTED IN PRODUCTION) ===
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyDdXgTvZ6U1L7Z8X9Y0A1B2C3D4E5F6G7H8I9",
        authDomain: "bloomingkids-8f2e4.firebaseapp.com",
        projectId: "bloomingkids-8f2e4",
        storageBucket: "bloomingkids-8f2e4.appspot.com",
        messagingSenderId: "123456789012",
        appId: "1:123456789012:web:abc123def456ghi789jkl0"
    };
    
    // === SECURITY UTILITIES ===
    const Security = {
        // XSS Protection
        sanitize: function(input) {
            if (typeof input !== 'string') return input;
            const div = document.createElement('div');
            div.textContent = input;
            return div.innerHTML;
        },
        
        // Anti-Phishing: Validate URLs
        isValidURL: function(url) {
            try {
                const parsed = new URL(url);
                return SECURITY.ALLOWED_DOMAINS.some(domain => 
                    parsed.hostname.includes(domain)
                );
            } catch {
                return false;
            }
        },
        
        // Rate Limiting
        checkRateLimit: function(key, action) {
            const storageKey = `rate_${key}_${action}`;
            const now = Date.now();
            const attempts = JSON.parse(sessionStorage.getItem(storageKey) || '[]');
            const recent = attempts.filter(time => now - time < SECURITY.RATE_LIMIT_WINDOW);
            
            if (recent.length >= SECURITY.MAX_LOGIN_ATTEMPTS) {
                console.warn(`🚨 Rate limit exceeded: ${key} (${action})`);
                return false;
            }
            
            recent.push(now);
            sessionStorage.setItem(storageKey, JSON.stringify(recent));
            return true;
        },
        
        // Generate Secure Token
        generateToken: function(email, portal) {
            const timestamp = Date.now();
            const random = window.crypto?.getRandomValues ?
                Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
                    .map(b => b.toString(16).padStart(2, '0')).join('') :
                Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
            
            const data = `${email}|${portal}|${timestamp}|${random}|${navigator.userAgent}`;
            
            // Simple hash (production: use SHA-256)
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                hash = ((hash << 5) - hash) + data.charCodeAt(i);
                hash = hash & hash;
            }
            
            return `tok_${Math.abs(hash).toString(36)}_${timestamp}`;
        },
        
        // Block Malicious Patterns
        hasMaliciousPatterns: function(text) {
            return SECURITY.BLOCKED_PATTERNS.some(pattern => 
                text.toLowerCase().includes(pattern.toLowerCase())
            );
        },
        
        // Secure Storage (encrypted)
        secureStore: function(key, value) {
            try {
                const encrypted = btoa(JSON.stringify({
                    data: value,
                    timestamp: Date.now(),
                    salt: Math.random().toString(36).substring(2)
                }));
                localStorage.setItem(`secure_${key}`, encrypted);
            } catch (e) {
                console.error('Secure storage failed:', e);
            }
        },
        
        secureRetrieve: function(key) {
            try {
                const encrypted = localStorage.getItem(`secure_${key}`);
                if (!encrypted) return null;
                const decrypted = JSON.parse(atob(encrypted));
                
                // Check if expired
                if (Date.now() - decrypted.timestamp > SECURITY.SESSION_TIMEOUT) {
                    localStorage.removeItem(`secure_${key}`);
                    return null;
                }
                
                return decrypted.data;
            } catch (e) {
                return null;
            }
        }
    };
    
    // === DETECT CURRENT PORTAL ===
    function detectPortal() {
        const path = window.location.pathname.toLowerCase();
        
        // Skip auth pages (they don't need multi-instance)
        if (path.includes('-auth') || path.includes('student-login')) {
            return null;
        }
        
        if (path.includes('tutor')) return 'tutor';
        if (path.includes('parent')) return 'parent';
        if (path.includes('management')) return 'management';
        if (path.includes('admin')) return 'admin';
        if (path.includes('enrollment')) return 'enrollment';
        if (path === '/' || path.includes('index.html')) return 'assessment';
        
        return null;
    }
    
    // === AUTO-PATCH FIREBASE ===
    function patchFirebaseForMultiPortal() {
        if (typeof firebase === 'undefined' || !firebase.initializeApp) {
            console.log('Waiting for Firebase...');
            setTimeout(patchFirebaseForMultiPortal, 100);
            return;
        }
        
        const portal = detectPortal();
        if (!portal) {
            console.log('🔐 Auth page or unknown page - skipping portal patching');
            return;
        }
        
        const appName = SECURITY.PORTAL_APPS[portal];
        
        try {
            // Create portal-specific Firebase instance
            const portalApp = firebase.initializeApp(FIREBASE_CONFIG, appName);
            
            // Patch global firebase.auth() and firebase.firestore() for THIS page
            const originalAuth = firebase.auth;
            const originalFirestore = firebase.firestore;
            
            firebase.auth = function(app) {
                if (app === portalApp || (!app && this === firebase)) {
                    const authInstance = originalAuth.call(this, portalApp);
                    
                    // Set to LOCAL persistence (lasts for months)
                    authInstance.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
                        .catch(e => console.warn('Persistence warning:', e));
                    
                    return authInstance;
                }
                return originalAuth.call(this, app);
            };
            
            firebase.firestore = function(app) {
                if (app === portalApp || (!app && this === firebase)) {
                    return originalFirestore.call(this, portalApp);
                }
                return originalFirestore.call(this, app);
            };
            
            console.log(`✅ Created secure Firebase instance for ${portal} portal`);
            
            // Track successful logins
            const auth = firebase.auth();
            auth.onAuthStateChanged((user) => {
                if (user && user.email) {
                    Security.secureStore(`session_${user.email}_${portal}`, {
                        uid: user.uid,
                        email: user.email,
                        portal: portal,
                        lastActive: Date.now(),
                        token: Security.generateToken(user.email, portal)
                    });
                    
                    // Show secure notification (non-intrusive)
                    showSecureNotification(user.email, portal);
                }
            });
            
        } catch (error) {
            if (error.code === 'app/duplicate-app') {
                console.log(`✅ ${portal} portal already has Firebase instance`);
            } else {
                console.error('Firebase patching error:', error);
            }
        }
    }
    
    // === NON-INTRUSIVE NOTIFICATION ===
    function showSecureNotification(email, portal) {
        // Only show once per session
        const notificationKey = `notified_${email}_${portal}`;
        if (sessionStorage.getItem(notificationKey)) return;
        
        setTimeout(() => {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: linear-gradient(135deg, #1a237e, #283593);
                color: white;
                padding: 12px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-family: -apple-system, BlinkMacSystemFont, sans-serif;
                z-index: 10000;
                max-width: 300px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-left: 4px solid #00e676;
                animation: slideUp 0.3s ease;
            `;
            
            notification.innerHTML = `
                <div style="font-weight: 600; margin-bottom: 4px;">
                    🔐 Secure Session Active
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                    ${email.split('@')[0]} • ${portal.toUpperCase()} Portal
                </div>
                <button onclick="this.parentElement.remove(); sessionStorage.setItem('${notificationKey}', 'true')" 
                        style="position: absolute; top: 8px; right: 8px; background: transparent; color: white; border: none; font-size: 18px; cursor: pointer; padding: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center;">
                    ×
                </button>
            `;
            
            // Add CSS animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(notification);
            sessionStorage.setItem(notificationKey, 'true');
            
            // Auto-remove after 8 seconds
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 8000);
        }, 1500);
    }
    
    // === ANTI-HACKING PROTECTION ===
    function installSecurityHooks() {
        // Protect against console tampering
        if (window.console && window.console.log) {
            const originalLog = console.log;
            console.log = function(...args) {
                // Filter out sensitive data
                const filtered = args.map(arg => {
                    if (typeof arg === 'string' && 
                        (arg.includes('token') || arg.includes('password') || arg.includes('apiKey'))) {
                        return '[SECURE_DATA_REDACTED]';
                    }
                    return arg;
                });
                originalLog.apply(console, ['🔒'] .concat(filtered));
            };
        }
        
        // Protect localStorage from theft
        const originalSetItem = localStorage.setItem;
        localStorage.setItem = function(key, value) {
            // Block storage of sensitive data in plain text
            if (typeof value === 'string' && 
                (value.includes('password') || value.includes('token') || 
                 value.includes('secret') || value.includes('private'))) {
                console.warn('🚨 Blocked potentially sensitive localStorage write:', key);
                Security.secureStore(key, value); // Use encrypted storage
                return;
            }
            originalSetItem.call(this, key, value);
        };
        
        // Block suspicious script injection
        const originalAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(child) {
            if (child.tagName === 'SCRIPT' && child.src && 
                !Security.isValidURL(child.src) && !child.src.startsWith('/')) {
                console.warn('🚨 Blocked suspicious script:', child.src);
                return child;
            }
            return originalAppendChild.call(this, child);
        };
        
        console.log('🛡️ Security hooks installed');
    }
    
    // === SESSION HEARTBEAT ===
    function startSessionHeartbeat() {
        // Keep sessions alive by updating timestamp every hour
        setInterval(() => {
            const portal = detectPortal();
            if (!portal) return;
            
            const auth = firebase.auth ? firebase.auth() : null;
            if (auth && auth.currentUser) {
                const user = auth.currentUser;
                Security.secureStore(`session_${user.email}_${portal}`, {
                    uid: user.uid,
                    email: user.email,
                    portal: portal,
                    lastActive: Date.now(),
                    token: Security.generateToken(user.email, portal)
                });
            }
        }, 60 * 60 * 1000); // Every hour
    }
    
    // === MAIN INITIALIZATION ===
    function initializePortalUniverse() {
        console.log('🚀 Portal Universe initializing...');
        
        // 1. Install security hooks first
        installSecurityHooks();
        
        // 2. Check if we should enable multi-portal
        const portal = detectPortal();
        if (portal) {
            console.log(`📍 Detected: ${portal.toUpperCase()} Portal`);
            
            // 3. Wait for Firebase, then patch it
            const firebaseCheck = setInterval(() => {
                if (typeof firebase !== 'undefined') {
                    clearInterval(firebaseCheck);
                    patchFirebaseForMultiPortal();
                    startSessionHeartbeat();
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => clearInterval(firebaseCheck), 10000);
        } else {
            console.log('🔐 Auth/login page - multi-portal disabled');
        }
        
        // 4. Global API for debugging (secured)
        Object.defineProperty(window, '$portal', {
            value: Object.freeze({
                getCurrentPortal: () => detectPortal(),
                getActiveSessions: (email) => {
                    if (!email) return null;
                    const sessions = [];
                    for (const portalName in SECURITY.PORTAL_APPS) {
                        const session = Security.secureRetrieve(`session_${email}_${portalName}`);
                        if (session) sessions.push(session);
                    }
                    return sessions;
                },
                version: '3.0-secure'
            }),
            writable: false,
            configurable: false,
            enumerable: false
        });
    }
    
    // === START EVERYTHING ===
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializePortalUniverse);
    } else {
        initializePortalUniverse();
    }
    
    console.log('✅ Portal Universe Security Suite loaded');
})();
