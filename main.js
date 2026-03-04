// ============================================================
// main.js  —  loaded by management.html as type="module"
//
// Responsibilities:
//   1. Boot the app by importing core/auth.js
//   2. Apply the mobile CSS/DOM compatibility patch
//
// Adding a new panel? Edit core/auth.js only. This file never grows.
// ============================================================

import './core/auth.js';

// ── Mobile compatibility patch ────────────────────────────────
// Fixes modal sizing and table horizontal scroll on small screens.
(function initMobilePatches() {

    // 1. INJECT GLOBAL CSS FIXES (Solves Dark Shade & Scrolling)
    const patchStyles = document.createElement('style');
    patchStyles.innerHTML = `
        /* Force tables to scroll horizontally on mobile */
        .overflow-x-auto { overflow-x: auto !important; }
        
        /* Fix the dark shade overlay getting stuck or layering wrong */
        .fixed.inset-0.bg-black { z-index: 40 !important; } 
        .fixed.inset-0.z-50 { z-index: 50 !important; }
        
        /* On mobile, ensure modals have breathing room */
        @media (max-width: 640px) {
            .w-96 { width: 92% !important; margin: 0 auto !important; }
            .max-w-lg { max-width: 92% !important; }
            .max-w-2xl { max-width: 95% !important; }
            .max-w-4xl { max-width: 95% !important; }
            
            /* Fix specific container padding */
            .p-8 { padding: 1.5rem !important; }
            
            /* Ensure the main content doesn't get hidden behind sidebar */
            #main-content { width: 100% !important; overflow-x: hidden !important; }
        }
    `;
    document.head.appendChild(patchStyles);

    // 2. ACTIVATE THE DOM WATCHER (The Automatic Fixer)
    // This watches your screen. If the app tries to show a broken modal, this fixes it instantly.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // If it's an HTML element
                    
                    // A. FIX TABLES (Prevent cutoff)
                    // Finds any div with 'overflow-hidden' that contains a table and switches it to scrollable
                    if (node.classList.contains('overflow-hidden') || node.querySelector('table')) {
                        if (node.classList.contains('shadow') || node.tagName === 'TABLE') {
                            node.classList.remove('overflow-hidden');
                            node.classList.add('overflow-x-auto');
                        }
                        // Deep check for inner containers
                        const tableContainers = node.querySelectorAll('.overflow-hidden');
                        tableContainers.forEach(container => {
                            container.classList.remove('overflow-hidden');
                            container.classList.add('overflow-x-auto');
                        });
                    }

                    // B. FIX MODALS (Prevent "Dark Shade" & Off-screen issues)
                    // If this is a modal container (fixed inset-0)
                    if (node.classList.contains('fixed') && node.classList.contains('inset-0')) {
                        
                        // Fix 1: Add scrolling to the black background wrapper itself
                        node.classList.add('overflow-y-auto');
                        
                        // Fix 2: Find the white box inside and make it responsive
                        const modalBox = node.querySelector('.bg-white');
                        if (modalBox) {
                            // Remove fixed desktop widths
                            modalBox.classList.remove('w-96', 'w-full');
                            
                            // Add responsive mobile widths
                            modalBox.classList.add('w-11/12', 'mx-auto', 'my-8');
                            
                            // Ensure it has a max-width for desktop
                            if (!modalBox.classList.contains('max-w-4xl')) {
                                modalBox.classList.add('max-w-lg');
                            }
                        }
                    }
                }
            });
        });
    });

    // Start watching the body for changes
    observer.observe(document.body, { childList: true, subtree: true });
})();