/*******************************************************************************
 * PORTAL INJECTOR - FIXED VERSION
 * Skips ALL auth/login pages including enrollment.html
 ******************************************************************************/

(function() {
    'use strict';
    
    // === PAGES THAT SHOULD NOT GET PORTAL PROTECTION ===
    const NO_PROTECTION_PAGES = [
        // Auth pages
        'tutor-auth', 'parent-auth', 'management-auth',
        'admin-auth', 'enrollment-auth', 'student-login',
        
        // Enrollment portal (it's an auth/login page)
        'enrollment', 'enrollment-portal',
        
        // File extensions
        'tutor-auth.html', 'parent-auth.html', 'management-auth.html',
        'admin-auth.html', 'enrollment-auth.html', 'student-login.html',
        'enrollment.html'
    ];
    
    // === CHECK IF CURRENT PAGE SHOULD BE PROTECTED ===
    function shouldProtectThisPage() {
        const path = window.location.pathname.toLowerCase();
        
        // Check if this is an auth/login page
        for (const page of NO_PROTECTION_PAGES) {
            if (path.includes(page.toLowerCase())) {
                console.log(`⏭️ Skipping portal protection on: ${page}`);
                return false;
            }
        }
        
        // Check if this is a portal page that needs protection
        const portalPages = [
            'tutor.html', 'parent.html', 'management.html',
            'admin.html', 'index.html', '/'
        ];
        
        for (const page of portalPages) {
            if (path.includes(page.toLowerCase())) {
                return true;
            }
        }
        
        // Check for portal routes without .html
        const portalRoutes = ['/tutor', '/parent', '/management', '/admin'];
        for (const route of portalRoutes) {
            if (path.startsWith(route) && path !== route + '-auth') {
                return true;
            }
        }
        
        return false;
    }
    
    // === INJECT PORTAL PROTECTOR ===
    function injectPortalProtector() {
        // Already injected?
        if (document.querySelector('script[data-portal-protector]')) {
            return;
        }
        
        const script = document.createElement('script');
        script.src = '/portal-protector.js';
        script.async = true;
        script.setAttribute('data-portal-protector', 'true');
        
        script.onerror = () => {
            console.error('Failed to load portal protector');
            script.remove();
        };
        
        script.onload = () => {
            console.log('✅ Portal protector loaded');
        };
        
        // Inject at the beginning of head
        if (document.head) {
            document.head.insertBefore(script, document.head.firstChild);
            console.log('🔒 Portal protection injected');
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.head.insertBefore(script, document.head.firstChild);
            });
        }
    }
    
    // === MAIN ===
    function main() {
        if (shouldProtectThisPage()) {
            console.log('🛡️ This page needs portal protection');
            setTimeout(injectPortalProtector, 100);
        } else {
            console.log('🔐 Auth/login page - no portal protection needed');
        }
    }
    
    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', main);
    } else {
        main();
    }
})();
