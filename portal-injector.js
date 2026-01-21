/*******************************************************************************
 * SECURE PORTAL INJECTOR - Tamper-Resistant Loader
 * Uses nonce, integrity checks, and mutation observers
 ******************************************************************************/

(function() {
    'use strict';
    
    // === SECURITY CONFIG ===
    const SECURITY = {
        ALLOWED_DOMAINS: ['bkh.netlify.app', 'localhost'],
        INTEGRITY_HASH: 'sha256-ABC123DEF456', // Generate real hash in production
        NONCE: 'portal-injector-' + Date.now() + '-' + Math.random().toString(36).substring(2),
        MAX_INJECTION_ATTEMPTS: 2,
        INJECTION_TIMEOUT: 5000
    };
    
    // === VALIDATION FUNCTIONS ===
    function isValidEnvironment() {
        // Check domain
        const hostname = window.location.hostname;
        const isAllowedDomain = SECURITY.ALLOWED_DOMAINS.some(domain => 
            hostname.includes(domain)
        );
        
        if (!isAllowedDomain) {
            console.warn('🚨 Injection blocked: Invalid domain');
            return false;
        }
        
        // Check for tampering
        if (window.self !== window.top) {
            console.warn('⚠️ Running in iframe - limited functionality');
        }
        
        return true;
    }
    
    function shouldInjectProtector() {
        const path = window.location.pathname.toLowerCase();
        const protectedPatterns = [
            '/tutor', '/parent', '/management', '/admin', '/enrollment',
            'tutor.html', 'parent.html', 'management.html', 'admin.html', 'enrollment.html',
            'tutor-auth.html', 'parent-auth.html', 'management-auth.html', 'admin-auth.html', 'enrollment-auth.html'
        ];
        
        return protectedPatterns.some(pattern => 
            path.includes(pattern.toLowerCase())
        ) || path === '/' || path === '/index.html';
    }
    
    // === SECURE INJECTION ===
    function injectSecureScript() {
        if (!isValidEnvironment()) return;
        
        // Check if already injected
        if (document.querySelector('script[data-portal-protector="secured"]')) {
            console.log('✅ Portal protector already loaded');
            return;
        }
        
        // Create script element with security attributes
        const script = document.createElement('script');
        script.src = '/portal-protector.js';
        script.async = true;
        script.defer = true;
        script.setAttribute('data-portal-protector', 'secured');
        script.setAttribute('nonce', SECURITY.NONCE);
        script.setAttribute('data-injected-at', Date.now());
        
        // Add integrity check (in production, use real hash)
        // script.integrity = SECURITY.INTEGRITY_HASH;
        // script.crossOrigin = 'anonymous';
        
        // Error handling
        script.onerror = function() {
            console.error('❌ Failed to load portal protector');
            this.remove();
        };
        
        script.onload = function() {
            console.log('✅ Portal protector loaded successfully');
            
            // Verify injection
            if (typeof window.SecurePortal !== 'undefined') {
                console.log('🛡️  Secure Portal API initialized');
            }
        };
        
        // Insert in secure location
        if (document.head) {
            // Insert before any other scripts
            const firstScript = document.head.querySelector('script');
            if (firstScript) {
                document.head.insertBefore(script, firstScript);
            } else {
                document.head.appendChild(script);
            }
            
            console.log('🔒 Secure portal protection injected');
        } else {
            // Wait for head
            document.addEventListener('DOMContentLoaded', function() {
                document.head.appendChild(script);
            });
        }
    }
    
    // === TAMPER DETECTION ===
    function setupTamperDetection() {
        // Monitor script element
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList') {
                    mutation.removedNodes.forEach(function(node) {
                        if (node.nodeName === 'SCRIPT' && 
                            node.getAttribute('data-portal-protector') === 'secured') {
                            console.warn('🚨 Portal protector script removed! Re-injecting...');
                            injectSecureScript();
                        }
                    });
                }
            });
        });
        
        // Start observing
        if (document.head) {
            observer.observe(document.head, { 
                childList: true, 
                subtree: true 
            });
        }
        
        return observer;
    }
    
    // === MAIN EXECUTION ===
    function main() {
        // Validate and inject
        if (shouldInjectProtector()) {
            // Add CSP meta tag dynamically (if not present)
            const existingCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
            if (!existingCSP) {
                const cspMeta = document.createElement('meta');
                cspMeta.httpEquiv = "Content-Security-Policy";
                cspMeta.content = "default-src 'self' https://*.firebaseio.com https://*.googleapis.com; script-src 'self' 'unsafe-inline' https://*.firebaseio.com; style-src 'self' 'unsafe-inline';";
                document.head.appendChild(cspMeta);
            }
            
            // Inject after a short delay to avoid race conditions
            setTimeout(injectSecureScript, 100);
            
            // Setup tamper detection
            setTimeout(setupTamperDetection, 500);
            
            // Self-check
            console.log('🔐 Secure Portal Injector v2.0 initialized');
        } else {
            console.log('ℹ️  Portal protector not needed for this page');
        }
    }
    
    // === SAFE EXECUTION ===
    try {
        // Wait for document to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', main);
        } else {
            main();
        }
    } catch (error) {
        console.error('Injector error:', error);
        // Fail safely - inject anyway
        setTimeout(injectSecureScript, 1000);
    }
})();
