import { getDashboardHTML, initializeDashboard } from './dashboard.js';
import { getChecklistHTML, initializeChecklist } from './checklist.js';

document.addEventListener('DOMContentLoaded', () => {
    const pageContent = document.getElementById('page-content');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('main-content');
    const navLinks = document.querySelectorAll('.nav-link');

    // --- Navigation Logic ---
    function navigateTo(hash) {
        // Remove active class from all links
        navLinks.forEach(link => link.classList.remove('active'));
        
        const activeLink = document.querySelector(`a[href="${hash}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Load page content
        pageContent.innerHTML = ''; // Clear previous content
        if (hash === '#dashboard') {
            pageContent.innerHTML = getDashboardHTML();
            initializeDashboard();
        } else if (hash === '#checklist') {
            pageContent.innerHTML = getChecklistHTML();
            initializeChecklist();
        } else {
            // Default to dashboard
            pageContent.innerHTML = getDashboardHTML();
            initializeDashboard();
            document.querySelector(`a[href="#dashboard"]`).classList.add('active');
        }
    }

    // --- Event Listeners ---
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        mainContent.classList.toggle('sidebar-active');
    });

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const hash = e.currentTarget.getAttribute('href');
            window.location.hash = hash; // Update URL hash
            sidebar.classList.remove('active'); // Hide sidebar on mobile after click
            mainContent.classList.remove('sidebar-active');
        });
    });

    // Handle initial page load and hash changes
    window.addEventListener('hashchange', () => navigateTo(window.location.hash));
    navigateTo(window.location.hash || '#dashboard'); // Load initial page
});
