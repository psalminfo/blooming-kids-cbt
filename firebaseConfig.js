// firebaseConfig.js - MODULAR VERSION with per-portal auth isolation

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
    getAuth,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ─────────────────────────────────────────────
// FIREBASE CONFIGS
// ─────────────────────────────────────────────

const mainConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

const devConfig = {
    apiKey: "AIzaSyAu36oLPNsk0TPKVIwCzEHe9oOtJ7cZQXA",
    authDomain: "blooming-kids-dev.firebaseapp.com",
    projectId: "blooming-kids-dev",
    storageBucket: "blooming-kids-dev.firebasestorage.app",
    messagingSenderId: "336022609689",
    appId: "1:336022609689:web:ad5a0a74dcac011f21ef88"
};

// ─────────────────────────────────────────────
// ENVIRONMENT DETECTION
// ─────────────────────────────────────────────

const hostname = window.location.hostname;
const isDevelopment =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.includes("bkhdevelop.netlify.app");

const firebaseConfig = isDevelopment ? devConfig : mainConfig;

// Expose globally for any compat SDK scripts in HTML
window.firebaseConfig = firebaseConfig;

console.log("Environment:", isDevelopment ? "🛠️ DEVELOPMENT" : "🚀 PRODUCTION");

// ─────────────────────────────────────────────
// PORTAL DETECTION
// Reads the page URL to figure out which portal
// this script is running in. Add more portals
// here if you create new ones in the future.
// window.__portalName is an optional manual
// override — set it BEFORE importing this file
// if auto-detection ever gets it wrong.
// ─────────────────────────────────────────────

const path = window.location.pathname.toLowerCase();

const portalName =
    window.__portalName             ? window.__portalName  :
    path.includes("admin")          ? "admin-portal"       :
    path.includes("parent")         ? "parent-portal"      :
    path.includes("management")     ? "management-portal"  :
    path.includes("tutor")          ? "tutor-portal"       :
    "default-portal"; // fallback — shouldn't normally hit this

console.log("🏫 Portal:", portalName);

// ─────────────────────────────────────────────
// FIREBASE APP INITIALIZATION
// Each portal gets its own named Firebase app
// instance so their auth sessions are completely
// independent. Logging into admin won't touch
// the parent, tutor, or management session.
// getApp() reuse prevents duplicate-app errors
// if this file is imported more than once.
// ─────────────────────────────────────────────

const existingApp = getApps().find(a => a.name === portalName);
const app = existingApp ? getApp(portalName) : initializeApp(firebaseConfig, portalName);

// ─────────────────────────────────────────────
// FIREBASE SERVICES
// Import in any portal file like:
// import { auth, db, storage } from './firebaseConfig.js';
// ─────────────────────────────────────────────

export const db      = getFirestore(app);
export const storage = getStorage(app);
export const auth    = getAuth(app);

// ─────────────────────────────────────────────
// AUTH PERSISTENCE — SESSION SCOPED PER TAB
// Each tab maintains its own independent login.
// Admin in Tab 1 + Parent in Tab 2 = no conflict.
// Refreshing keeps the user logged in.
// Closing the tab signs them out automatically.
// ─────────────────────────────────────────────

await setPersistence(auth, browserSessionPersistence);
