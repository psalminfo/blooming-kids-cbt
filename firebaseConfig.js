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
// Detects which portal this page belongs to
// based on the URL path or filename.
// Add more keywords here if your URLs differ.
// ─────────────────────────────────────────────

const path = window.location.pathname.toLowerCase();

const portalName =
    path.includes("admin")      ? "admin-portal"      :
    path.includes("parent")     ? "parent-portal"     :
    path.includes("management") ? "management-portal" :
    path.includes("tutor")      ? "tutor-portal"      :
    "default-portal"; // fallback — shouldn't normally hit this

console.log("Portal:", portalName);

// ─────────────────────────────────────────────
// FIREBASE APP INITIALIZATION
// Each portal gets its own named app instance
// so their auth sessions never interfere.
// getApp() reuse prevents duplicate-app errors
// if this file is imported more than once.
// ─────────────────────────────────────────────

const existingApp = getApps().find(a => a.name === portalName);
const app = existingApp ? getApp(portalName) : initializeApp(firebaseConfig, portalName);

// ─────────────────────────────────────────────
// SERVICES
// ─────────────────────────────────────────────

export const db      = getFirestore(app);
export const storage = getStorage(app);
export const auth    = getAuth(app);

// ─────────────────────────────────────────────
// AUTH PERSISTENCE — SESSION SCOPED
// Each browser tab maintains its own login.
// Opening admin in Tab 1 and parent in Tab 2
// will NOT log each other out.
// ─────────────────────────────────────────────

await setPersistence(auth, browserSessionPersistence);
