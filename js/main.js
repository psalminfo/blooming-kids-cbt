// js/main.js
import { getDashboardHTML, initializeDashboard } from './dashboard.js';
import { getChecklistHTML, initializeChecklist } from './checklist.js';
import { auth } from '../firebaseConfig.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

const ADMIN_EMAIL = 'psalm4all@gmail.com';

document.addEventListener('DOMContentLoaded', () => {
    const pageContent = document.getElementById('page-content');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const navLinks = document.querySelectorAll('.nav-link');

    function navigateTo(hash) {
        navLinks.forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`a[href="${hash}"]`);
        if (activeLink) activeLink.classList.add('active');

        pageContent.innerHTML = ''; // Clear previous content
        if (hash === '#dashboard') {
            pageContent.innerHTML = getDashboardHTML();
            initializeDashboard();
        } else if (hash === '#checklist') {
            pageContent.innerHTML = getChecklistHTML();
            initializeChecklist();
        } else {
            pageContent.innerHTML = getDashboardHTML();
            initializeDashboard();
            document.querySelector(`a[href="#dashboard"]`).classList.add('active');
        }
    }

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        mainContentWrapper.classList.toggle('sidebar-active');
    });

    window.addEventListener('hashchange', () => navigateTo(window.location.hash));
    
    // Auth check logic is now here
    onAuthStateChanged(auth, (user) => {
        if (user && user.email === ADMIN_EMAIL) {
            console.log("Admin authenticated. Loading panel.");
            navigateTo(window.location.hash || '#dashboard');
        } else {
            console.log("User not authenticated or not an admin. Redirecting...");
            window.location.href = "admin-auth.html";
        }
    });

    // Logout logic
    const logoutBtn = document.getElementById('logoutBtn');
    logoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        window.location.href = "admin-auth.html";
    });
});
