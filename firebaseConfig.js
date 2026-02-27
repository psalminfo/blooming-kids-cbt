// firebaseConfig.js — UNIVERSAL VERSION
// Shared by ALL portals (admin, parent, tutor, management).
// Provides both MODULAR exports (for modern portals) and a
// COMPAT bridge (for portals still using the compat SDK).
// ─────────────────────────────────────────────────────────

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore }                    from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage }                      from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import {
    getAuth,
    setPersistence,
    browserSessionPersistence
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ─────────────────────────────────────────────
// FIREBASE PROJECT CONFIGS
// ─────────────────────────────────────────────

const mainConfig = {
    apiKey:            "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain:        "bloomingkidsassessment.firebaseapp.com",
    projectId:         "bloomingkidsassessment",
    storageBucket:     "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId:             "1:238975054977:web:87c70b4db044998a204980"
};

const devConfig = {
    apiKey:            "AIzaSyAu36oLPNsk0TPKVIwCzEHe9oOtJ7cZQXA",
    authDomain:        "blooming-kids-dev.firebaseapp.com",
    projectId:         "blooming-kids-dev",
    storageBucket:     "blooming-kids-dev.firebasestorage.app",
    messagingSenderId: "336022609689",
    appId:             "1:336022609689:web:ad5a0a74dcac011f21ef88"
};

// ─────────────────────────────────────────────
// ENVIRONMENT DETECTION
// ─────────────────────────────────────────────

const hostname = window.location.hostname;
const isDevelopment =
    hostname === "localhost"  ||
    hostname === "127.0.0.1"  ||
    hostname.includes("bkhdevelop.netlify.app") ||
    hostname.includes("dev.")     ||
    hostname.includes("staging.");

const firebaseConfig = isDevelopment ? devConfig : mainConfig;

// Expose globally — the compat bridge and any other script can read this.
window.firebaseConfig     = firebaseConfig;
window.firebaseMainConfig = mainConfig;
window.firebaseDevConfig  = devConfig;

console.log("Environment:", isDevelopment ? "🛠️ DEVELOPMENT" : "🚀 PRODUCTION");

// ─────────────────────────────────────────────
// PORTAL DETECTION
// ─────────────────────────────────────────────

const path = window.location.pathname.toLowerCase();

const portalName =
    window.__portalName             ? window.__portalName  :
    path.includes("admin")          ? "admin-portal"       :
    path.includes("parent")         ? "parent-portal"      :
    path.includes("management")     ? "management-portal"  :
    path.includes("tutor")          ? "tutor-portal"       :
    "default-portal";

console.log("🏫 Portal:", portalName);

// ─────────────────────────────────────────────
// MODULAR FIREBASE APP (for modern portals)
// ─────────────────────────────────────────────

const existingApp = getApps().find(a => a.name === portalName);
const app = existingApp
    ? getApp(portalName)
    : initializeApp(firebaseConfig, portalName);

// ─────────────────────────────────────────────
// MODULAR EXPORTS
// Other portals import like:
//   import { auth, db, storage } from './firebaseConfig.js';
// ─────────────────────────────────────────────

export const db      = getFirestore(app);
export const storage = getStorage(app);
export const auth    = getAuth(app);

// ─────────────────────────────────────────────
// AUTH PERSISTENCE — SESSION SCOPED PER TAB
// ─────────────────────────────────────────────

try {
    await setPersistence(auth, browserSessionPersistence);
} catch (e) {
    console.warn("Could not set modular auth persistence:", e.message);
}

// ═════════════════════════════════════════════
// COMPAT SDK BRIDGE
// If the page has loaded the Firebase compat
// scripts (firebase-app-compat, etc.), this
// section initialises the compat app using the
// same config so portal JS that still uses the
// firebase.firestore() / firebase.auth() API
// works without any changes.
// ═════════════════════════════════════════════

if (typeof firebase !== "undefined" && firebase.initializeApp) {
    try {
        // Only init if no compat app exists yet
        if (!firebase.apps || firebase.apps.length === 0) {
            firebase.initializeApp(firebaseConfig);
            console.log(`✅ Compat SDK initialized (${firebaseConfig.projectId})`);
        } else {
            console.log("ℹ️  Compat SDK already initialized:", firebase.app().options.projectId);
        }

        // Create compat service references
        const compatDb   = firebase.firestore();
        const compatAuth = firebase.auth();

        // Expose on window so compat-based portal scripts
        // can simply use db / auth without importing.
        window.db   = compatDb;
        window.auth = compatAuth;

        // Enable Firestore offline persistence (compat)
        compatDb.enablePersistence({ synchronizeTabs: true }).catch((err) => {
            if (err.code === "failed-precondition") {
                console.warn("Firestore persistence: multiple tabs open");
            } else if (err.code === "unimplemented") {
                console.warn("Firestore persistence: browser unsupported");
            }
        });

        console.log("🔗 Compat bridge ready — window.db / window.auth available");

    } catch (err) {
        console.error("❌ Compat bridge error:", err);
    }
} else {
    console.log("ℹ️  No compat SDK detected — modular-only mode");
}

// ─────────────────────────────────────────────
// FIREBASE ERROR HANDLER (shared utility)
// Usage:  import { handleFirebaseError } from './firebaseConfig.js';
//   or:   window.handleFirebaseError(error);
// ─────────────────────────────────────────────

export function handleFirebaseError(error) {
    const env = isDevelopment ? " (Dev)" : "";

    const messages = {
        "permission-denied":        `You do not have permission to access this data.${env}`,
        "unavailable":              `Service unavailable. Check your connection.${env}`,
        "failed-precondition":      `Database operation failed. Try again.${env}`,
        "not-found":                `Requested data not found.${env}`,
        "auth/user-not-found":      `Invalid credentials.${env}`,
        "auth/wrong-password":      `Invalid credentials.${env}`,
        "auth/invalid-credential":  `Invalid credentials.${env}`,
        "auth/invalid-email":       `Invalid email format.${env}`,
        "auth/email-already-in-use":`This email is already registered.${env}`,
        "auth/too-many-requests":   `Too many attempts. Try again later.${env}`,
        "auth/weak-password":       `Password must be at least 6 characters.${env}`
    };

    return messages[error.code] || error.message || `An unknown error occurred.${env}`;
}

window.handleFirebaseError = handleFirebaseError;

// ─────────────────────────────────────────────
// ENVIRONMENT INFO (global, for any portal)
// ─────────────────────────────────────────────

window.firebaseEnv = {
    isDevelopment,
    hostname,
    portalName,
    projectId: firebaseConfig.projectId,
    getConfigType: () => isDevelopment ? "development" : "production"
};

console.log(`✅ firebaseConfig.js loaded — ${firebaseConfig.projectId} [${portalName}]`);
