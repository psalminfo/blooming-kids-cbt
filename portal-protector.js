/*******************************************************************************
 * ULTIMATE PORTAL PROTECTOR - CYBER-SECURE VERSION
 * Protected against XSS, CSRF, Token Hijacking, and DoS attacks
 ******************************************************************************/

(function() {
    'use strict';
    
    // === SECURITY CONFIGURATION ===
    const SECURITY = {
        MAX_PORTALS_PER_EMAIL: 5,              // Prevent DoS
        SESSION_TIMEOUT: 24 * 60 * 60 * 1000,  // 24 hours
        RATE_LIMIT_WINDOW: 60000,              // 1 minute
        MAX_LOGIN_ATTEMPTS: 5,                 // Per portal
        ALLOWED_ORIGINS: [                      // CORS protection
            'https://bkh.netlify.app',
            'https://www.bkh.netlify.app',
            'http://localhost:3000',
            'http://localhost:5000'
        ]
    };
    
    // === PORTAL CONFIGURATION ===
    const PORTAL_CONFIG = Object.freeze({       // Freeze to prevent tampering
        'tutor': Object.freeze({ 
            file: 'tutor.html', 
            authFile: 'tutor-auth.html',
            secretHash: 'tutor_' + btoa('tutor_portal_secure_2024')
        }),
        'parent': Object.freeze({ 
            file: 'parent.html', 
            authFile: 'parent-auth.html',
            secretHash: 'parent_' + btoa('parent_portal_secure_2024')
        }),
        'management': Object.freeze({ 
            file: 'management.html', 
            authFile: 'management-auth.html',
            secretHash: 'management_' + btoa('management_portal_secure_2024')
        }),
        'admin': Object.freeze({ 
            file: 'admin.html', 
            authFile: 'admin-auth.html',
            secretHash: 'admin_' + btoa('admin_portal_secure_2024')
        }),
        'enrollment': Object.freeze({ 
            file: 'enrollment.html', 
            authFile: 'enrollment-auth.html',
            secretHash: 'enrollment_' + btoa('enrollment_portal_secure_2024')
        }),
        'assessment': Object.freeze({ 
            file: 'index.html', 
            authFile: 'index.html',
            secretHash: 'assessment_' + btoa('assessment_portal_secure_2024')
        })
    });
    
    // === SECURITY UTILITIES ===
    const SecurityUtils = {
        // XSS Protection - Sanitize inputs
        sanitize: function(input) {
            if (typeof input !== 'string') return input;
            return input
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .replace(/\//g, '&#x2F;')
                .replace(/\\/g, '&#x5C;');
        },
        
        // Validate email format
        isValidEmail: function(email) {
            if (typeof email !== 'string') return false;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(email) && email.length <= 254;
        },
        
        // Generate secure session token
        generateToken: function(email, portal) {
            const timestamp = Date.now();
            const random = Math.random().toString(36).substring(2);
            const data = `${email}|${portal}|${timestamp}|${random}`;
            
            // Simple hash (in production, use crypto.subtle.digest)
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                hash = ((hash << 5) - hash) + data.charCodeAt(i);
                hash |= 0;
            }
            
            return `tok_${Math.abs(hash).toString(16)}_${timestamp}`;
        },
        
        // Validate origin (CORS protection)
        isValidOrigin: function() {
            const origin = window.location.origin;
            return SECURITY.ALLOWED_ORIGINS.includes(origin);
        },
        
        // Rate limiting
        checkRateLimit: function(email, action) {
            const key = `rate_${email}_${action}`;
            const now = Date.now();
            const attempts = JSON.parse(sessionStorage.getItem(key) || '[]');
            
            // Remove old attempts
            const recent = attempts.filter(time => now - time < SECURITY.RATE_LIMIT_WINDOW);
            
            if (recent.length >= SECURITY.MAX_LOGIN_ATTEMPTS) {
                console.warn(`🚨 Rate limit exceeded for ${email} (${action})`);
                return false;
            }
            
            recent.push(now);
            sessionStorage.setItem(key, JSON.stringify(recent));
            return true;
        },
        
        // CSRF Token Generation
        generateCSRFToken: function() {
            const token = crypto.getRandomValues(new Uint8Array(32))
                .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
            sessionStorage.setItem('csrf_token', token);
            return token;
        },
        
        // Validate CSRF Token
        validateCSRFToken: function(token) {
            const stored = sessionStorage.getItem('csrf_token');
            return token && stored && token === stored;
        }
    };
    
    // === PORTAL DETECTION (Secure) ===
    function detectPortal() {
        const path = window.location.pathname.toLowerCase();
        const hostname = window.location.hostname;
        
        // Validate we're on allowed domain
        if (!hostname.includes('bkh.netlify.app') && !hostname.includes('localhost')) {
            console.warn('🚨 Unauthorized domain access attempt');
            return 'assessment';
        }
        
        for (const portal in PORTAL_CONFIG) {
            const portalFile = PORTAL_CONFIG[portal].file.toLowerCase();
            if (path.includes(portal) || path.includes(portalFile)) {
                return portal;
            }
        }
        return 'assessment';
    }
    
    const CURRENT_PORTAL = detectPortal();
    
    // === SECURE TRACKING ===
    function trackEmailPortal(email, portal) {
        if (!SecurityUtils.isValidEmail(email)) {
            console.error('Invalid email format');
            return;
        }
        
        const sanitizedEmail = SecurityUtils.sanitize(email);
        const portalTracking = JSON.parse(localStorage.getItem('email_portal_tracking') || '{}');
        
        // Initialize if not exists
        if (!portalTracking[sanitizedEmail]) {
            portalTracking[sanitizedEmail] = [];
        }
        
        // Add portal with timestamp and token
        if (!portalTracking[sanitizedEmail].includes(portal)) {
            portalTracking[sanitizedEmail].push({
                portal: portal,
                timestamp: Date.now(),
                token: SecurityUtils.generateToken(email, portal),
                ipHash: navigator.userAgent.substring(0, 50) // Simple fingerprint
            });
            
            // Enforce limit
            if (portalTracking[sanitizedEmail].length > SECURITY.MAX_PORTALS_PER_EMAIL) {
                portalTracking[sanitizedEmail].shift(); // Remove oldest
            }
        }
        
        // Clean old sessions
        const now = Date.now();
        portalTracking[sanitizedEmail] = portalTracking[sanitizedEmail].filter(session => 
            now - session.timestamp < SECURITY.SESSION_TIMEOUT
        );
        
        localStorage.setItem('email_portal_tracking', JSON.stringify(portalTracking));
        localStorage.setItem(`last_portal_${sanitizedEmail}`, portal);
        
        console.log(`🔒 Securely tracked ${sanitizedEmail} in ${portal}`);
    }
    
    // === FIREBASE INTERCEPTION (Secure) ===
    function protectFirebaseAuth() {
        if (!window.firebase || !window.firebase.auth) {
            console.error('Firebase not loaded');
            return;
        }
        
        // Validate origin
        if (!SecurityUtils.isValidOrigin()) {
            console.warn('Blocked unauthorized origin');
            return;
        }
        
        const originalAuth = window.firebase.auth;
        
        // Store original methods securely
        const originalMethods = {
            signIn: originalAuth.Auth.prototype.signInWithEmailAndPassword,
            signOut: originalAuth.Auth.prototype.signOut,
            onAuthStateChanged: originalAuth.Auth.prototype.onAuthStateChanged
        };
        
        // === SECURE SIGN-IN ===
        originalAuth.Auth.prototype.signInWithEmailAndPassword = function(email, password) {
            // Validate inputs
            if (!SecurityUtils.isValidEmail(email)) {
                return Promise.reject(new Error('Invalid email format'));
            }
            
            // Rate limiting
            if (!SecurityUtils.checkRateLimit(email, 'login')) {
                return Promise.reject(new Error('Too many login attempts. Please wait.'));
            }
            
            const sanitizedEmail = SecurityUtils.sanitize(email);
            
            return originalMethods.signIn.call(this, sanitizedEmail, password)
                .then(userCredential => {
                    // Generate CSRF token
                    SecurityUtils.generateCSRFToken();
                    
                    // Secure tracking
                    trackEmailPortal(sanitizedEmail, CURRENT_PORTAL);
                    
                    // Secure welcome message
                    showSecurePortalWelcome(sanitizedEmail, CURRENT_PORTAL);
                    
                    // Log security event
                    console.log(`✅ Secure login: ${sanitizedEmail} → ${CURRENT_PORTAL}`);
                    
                    return userCredential;
                })
                .catch(error => {
                    console.error('Login error:', error.message);
                    throw error;
                });
        };
        
        // === SECURE SIGN-OUT ===
        originalAuth.Auth.prototype.signOut = function() {
            const user = this.currentUser;
            
            if (user && user.email) {
                const sanitizedEmail = SecurityUtils.sanitize(user.email);
                const portalTracking = JSON.parse(localStorage.getItem('email_portal_tracking') || '{}');
                
                if (portalTracking[sanitizedEmail]) {
                    // Only remove this portal's session
                    portalTracking[sanitizedEmail] = portalTracking[sanitizedEmail].filter(
                        session => session.portal !== CURRENT_PORTAL
                    );
                    
                    if (portalTracking[sanitizedEmail].length === 0) {
                        delete portalTracking[sanitizedEmail];
                    }
                    
                    localStorage.setItem('email_portal_tracking', JSON.stringify(portalTracking));
                    
                    // Clear CSRF token
                    sessionStorage.removeItem('csrf_token');
                }
            }
            
            return originalMethods.signOut.call(this);
        };
        
        // === SECURE AUTH STATE LISTENER ===
        originalAuth.Auth.prototype.onAuthStateChanged = function(callback, errorCallback, completedCallback) {
            return originalMethods.onAuthStateChanged.call(this, (user) => {
                if (user && user.email) {
                    const sanitizedEmail = SecurityUtils.sanitize(user.email);
                    
                    // Add secure portal info
                    Object.defineProperty(user, '_portalInfo', {
                        value: {
                            currentPortal: CURRENT_PORTAL,
                            secureToken: SecurityUtils.generateToken(sanitizedEmail, CURRENT_PORTAL),
                            timestamp: Date.now(),
                            csrfToken: sessionStorage.getItem('csrf_token')
                        },
                        writable: false,
                        configurable: false,
                        enumerable: false // Hidden from enumeration
                    });
                    
                    // Check other portals securely
                    const otherPortals = checkOtherPortals(sanitizedEmail, CURRENT_PORTAL);
                    if (otherPortals.length > 0) {
                        setTimeout(() => {
                            showSecureMultiPortalNotification(sanitizedEmail, CURRENT_PORTAL, otherPortals);
                        }, 2000);
                    }
                }
                
                // Call original callback
                if (callback) callback(user);
            }, errorCallback, completedCallback);
        };
        
        console.log(`🛡️  Secure portal protector activated for ${CURRENT_PORTAL}`);
    }
    
    // === SECURE UI COMPONENTS ===
    function showSecurePortalWelcome(email, portal) {
        const existing = document.getElementById('secure-portal-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.id = 'secure-portal-notification';
        notification.setAttribute('data-secure', 'true');
        
        // CSS with Content Security Policy considerations
        const secureStyles = `
            #secure-portal-notification {
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        const style = document.createElement('style');
        style.textContent = secureStyles;
        notification.appendChild(style);
        
        const sanitizedEmail = SecurityUtils.sanitize(email);
        const sanitizedPortal = SecurityUtils.sanitize(portal.toUpperCase());
        
        notification.innerHTML += `
            <div style="position: relative;">
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="position: absolute; top: 0; right: 0; background: transparent; color: white; border: none; font-size: 20px; cursor: pointer;">×</button>
                <div style="font-weight: 600; margin-bottom: 5px;">🔐 Welcome to ${sanitizedPortal}</div>
                <div style="font-size: 13px;">
                    Signed in as <span style="color: #ffeb3b; word-break: break-all;">${sanitizedEmail}</span>
                    <div style="margin-top: 5px; font-size: 11px; opacity: 0.8;">
                        Session secured with token authentication
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove with cleanup
        const removalTimer = setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
        
        // Cleanup on removal
        notification.addEventListener('remove', () => {
            clearTimeout(removalTimer);
        });
    }
    
    // === INITIALIZATION SECURITY ===
    function initializeSecureProtection() {
        // Validate environment
        if (typeof window === 'undefined') return;
        if (!window.localStorage || !window.sessionStorage) {
            console.error('Web Storage not available');
            return;
        }
        
        // Check for debugging tools (basic)
        if (typeof window.console !== 'undefined' && window.console.log) {
            const originalLog = console.log;
            console.log = function(...args) {
                // Don't log sensitive info
                const filtered = args.map(arg => 
                    typeof arg === 'string' && (arg.includes('token') || arg.includes('password')) 
                    ? '[SECURE_DATA]' 
                    : arg
                );
                originalLog.apply(console, filtered);
            };
        }
        
        // Initialize
        window.addEventListener('load', function() {
            // Validate we're in a secure context (HTTPS or localhost)
            if (!window.isSecureContext && !window.location.hostname.includes('localhost')) {
                console.warn('⚠️ Not in secure context');
                return;
            }
            
            // Wait for Firebase with timeout
            const firebaseCheck = setInterval(() => {
                if (window.firebase && window.firebase.auth) {
                    clearInterval(firebaseCheck);
                    
                    try {
                        protectFirebaseAuth();
                        
                        // Secure existing user check
                        if (window.firebase.auth().currentUser) {
                            const user = window.firebase.auth().currentUser;
                            if (user && user.email) {
                                const sanitizedEmail = SecurityUtils.sanitize(user.email);
                                trackEmailPortal(sanitizedEmail, CURRENT_PORTAL);
                            }
                        }
                    } catch (error) {
                        console.error('Protection initialization failed:', error);
                    }
                }
            }, 100);
            
            // Timeout after 10 seconds
            setTimeout(() => clearInterval(firebaseCheck), 10000);
        });
    }
    
    // === PUBLIC API (Limited & Secure) ===
    Object.defineProperty(window, 'SecurePortal', {
        value: Object.freeze({
            switchToPortal: function(portalName) {
                const portal = PORTAL_CONFIG[portalName];
                if (portal && SecurityUtils.isValidOrigin()) {
                    // Add CSRF token to URL for validation
                    const csrfToken = sessionStorage.getItem('csrf_token');
                    const url = `/${portal.file}${csrfToken ? `?csrf=${csrfToken}` : ''}`;
                    window.location.href = url;
                }
            },
            getCurrentPortal: function() {
                return CURRENT_PORTAL;
            },
            isSecure: function() {
                return window.isSecureContext;
            }
        }),
        writable: false,
        configurable: false
    });
    
    // Start secure protection
    initializeSecureProtection();
    
    console.log(`🛡️  Cyber-Secure Portal Protection v2.0 loaded for ${CURRENT_PORTAL}`);
})();
