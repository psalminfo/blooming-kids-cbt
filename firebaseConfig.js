// firebaseConfig.js - MODULAR VERSION with multi-portal isolation

import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// PRODUCTION CONFIG
const mainConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// DEVELOPMENT CONFIG
const devConfig = {
    apiKey: "AIzaSyAu36oLPNsk0TPKVIwCzEHe9oOtJ7cZQXA",
    authDomain: "blooming-kids-dev.firebaseapp.com",
    projectId: "blooming-kids-dev",
    storageBucket: "blooming-kids-dev.firebasestorage.app",
    messagingSenderId: "336022609689",
    appId: "1:336022609689:web:ad5a0a74dcac011f21ef88"
};

// ENVIRONMENT DETECTION
const hostname = window.location.hostname;
const isDevelopment = 
    hostname === "localhost" || 
    hostname === "127.0.0.1" || 
    hostname.includes("bkhdevelop.netlify.app");

const firebaseConfig = isDevelopment ? devConfig : mainConfig;

// ===== PORTAL DETECTION (customise if your URLs differ) =====
function getCurrentPortal() {
    const path = window.location.pathname.toLowerCase();

    // Skip auth/login pages – they don't need isolation
    if (path.includes('-auth') || path.includes('student-login')) return null;

    // Check for specific portal paths
    if (path.includes('/tutor/') || path.includes('tutor-dashboard')) return 'tutor';
    if (path.includes('/parent/') || path.includes('parent-dashboard')) return 'parent';
    if (path.includes('/management/') || path.includes('management-dashboard')) return 'management';
    if (path.includes('/admin/') || path.includes('admin-dashboard')) return 'admin';
    if (path.includes('/enrollment/') || path.includes('enrollment-dashboard')) return 'enrollment';
    if (path === '/' || path.includes('index.html') || path.includes('assessment')) return 'assessment';

    // Broader fallback (avoid auth pages)
    if (path.includes('tutor') && !path.includes('auth')) return 'tutor';
    if (path.includes('parent') && !path.includes('auth')) return 'parent';
    if (path.includes('management') && !path.includes('auth')) return 'management';
    if (path.includes('admin') && !path.includes('auth')) return 'admin';
    if (path.includes('enrollment') && !path.includes('auth')) return 'enrollment';

    return null; // not a portal page
}

const portal = getCurrentPortal();

// ===== Initialise a named app for the portal, otherwise default =====
let app;
if (portal) {
    const appName = `portal_${portal}`;
    try {
        app = initializeApp(firebaseConfig, appName);
    } catch (e) {
        if (e.code === 'app/duplicate-app') {
            app = getApp(appName); // already exists
        } else {
            throw e;
        }
    }
    console.log(`🔥 Firebase initialized for ${portal} portal (named app: ${appName})`);
} else {
    app = initializeApp(firebaseConfig);
    console.log('🔥 Firebase initialized (default app)');
}

// ===== Set LOCAL persistence so login survives page reloads =====
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(err => console.warn('Persistence error:', err));

// ===== Export the services – they will be portal‑specific =====
export const db = getFirestore(app);
export { auth };
export const storage = getStorage(app);

// Keep the global config for any legacy code
window.firebaseConfig = firebaseConfig;
