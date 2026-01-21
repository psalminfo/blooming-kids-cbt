// portal-injector.js - Auto-injects portal protection into all HTML files
(function() {
    'use strict';
    
    // List of ALL portal HTML files
    const PORTAL_FILES = [
        'tutor.html', 'tutor-auth.html',
        'parent.html', 'parent-auth.html', 
        'management.html', 'management-auth.html',
        'admin.html', 'admin-auth.html',
        'enrollment.html', 'enrollment-auth.html',
        'index.html'
    ];
    
    // Get current page filename
    const currentFile = window.location.pathname.split('/').pop().toLowerCase();
    
    // Check if current page is a portal
    const isPortalFile = PORTAL_FILES.some(file => 
        currentFile === file.toLowerCase() || 
        currentFile.startsWith(file.replace('.html', '').toLowerCase())
    );
    
    // Also check for hash routes (tutor.html#dashboard)
    const hasPortalInPath = PORTAL_FILES.some(file => 
        window.location.pathname.toLowerCase().includes(file.replace('.html', '').toLowerCase())
    );
    
    if (isPortalFile || hasPortalInPath) {
        // Inject portal-protector script
        const script = document.createElement('script');
        script.src = '/portal-protector.js';
        script.async = true;
        
        // Insert at the beginning of head to ensure it loads first
        if (document.head) {
            document.head.insertBefore(script, document.head.firstChild);
            console.log(`🔧 Injected portal protector into ${currentFile}`);
        } else {
            // If no head yet, wait for DOM
            document.addEventListener('DOMContentLoaded', function() {
                document.head.insertBefore(script, document.head.firstChild);
            });
        }
    }
})();
