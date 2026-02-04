// ============================================================================
// FIREBASE CONFIGURATION - PARENT PORTAL (UPDATED)
// ============================================================================

// Firebase config for the 'bloomingkidsassessment' project
const firebaseConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// ============================================================================
// FIREBASE INITIALIZATION (ENHANCED)
// ============================================================================

// Enhanced initialization to work in all environments
try {
    // Check if Firebase is already initialized
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log("✅ Firebase initialized successfully");
        } else {
            console.log("ℹ️ Firebase already initialized, using existing instance");
        }
    } else {
        console.error("❌ Firebase SDK not loaded");
        // Create a placeholder to prevent errors
        window.firebase = { 
            apps: [], 
            app: () => ({ 
                firestore: () => ({ 
                    enablePersistence: () => Promise.reject(),
                    collection: () => ({ get: () => Promise.reject() })
                }),
                auth: () => ({ 
                    onAuthStateChanged: () => {},
                    signOut: () => Promise.reject()
                })
            }),
            initializeApp: () => {}
        };
    }
} catch (error) {
    console.error("❌ Firebase initialization error:", error);
}

// ============================================================================
// FIREBASE SERVICE REFERENCES (WITH FALLBACKS)
// ============================================================================

// Create service references with fallbacks to prevent errors
let db, auth;

try {
    if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        db = firebase.firestore();
        auth = firebase.auth();
        
        // Enable Firestore offline persistence with error handling
        if (db && db.enablePersistence) {
            db.enablePersistence().catch((err) => {
                console.warn("Firestore persistence failed:", err.code);
            });
        }
    } else {
        console.warn("⚠️ Firebase not available, creating dummy services");
        // Create dummy services
        db = {
            collection: () => ({ 
                get: () => Promise.reject(new Error("Firebase not initialized")),
                doc: () => ({ 
                    get: () => Promise.reject(new Error("Firebase not initialized")),
                    set: () => Promise.reject(new Error("Firebase not initialized")),
                    update: () => Promise.reject(new Error("Firebase not initialized"))
                }),
                where: () => ({ get: () => Promise.reject(new Error("Firebase not initialized")) })
            }),
            batch: () => ({ 
                update: () => {},
                commit: () => Promise.reject(new Error("Firebase not initialized"))
            })
        };
        
        auth = {
            onAuthStateChanged: () => {},
            signOut: () => Promise.reject(new Error("Firebase not initialized")),
            signInWithEmailAndPassword: () => Promise.reject(new Error("Firebase not initialized")),
            createUserWithEmailAndPassword: () => Promise.reject(new Error("Firebase not initialized")),
            sendPasswordResetEmail: () => Promise.reject(new Error("Firebase not initialized")),
            currentUser: null
        };
    }
} catch (error) {
    console.error("❌ Error creating Firebase services:", error);
    // Create fallback services
    db = { collection: () => ({}) };
    auth = { onAuthStateChanged: () => {} };
}

// ============================================================================
// FIREBASE ERROR HANDLING
// ============================================================================

// Global Firebase error handler
function handleFirebaseError(error) {
    console.error("Firebase Error:", error);
    
    const errorMessages = {
        'permission-denied': 'You do not have permission to access this data.',
        'unavailable': 'Firebase service is unavailable. Please check your connection.',
        'failed-precondition': 'Database operation failed. Please try again.',
        'not-found': 'The requested data was not found.',
        'auth/user-not-found': 'No account found with this email.',
        'auth/wrong-password': 'Incorrect password.',
        'auth/invalid-email': 'Invalid email address format.',
        'auth/email-already-in-use': 'This email is already registered.',
        'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
        'auth/weak-password': 'Password should be at least 6 characters.'
    };
    
    return errorMessages[error.code] || error.message || 'An unknown Firebase error occurred.';
}

// ============================================================================
// FIREBASE CONFIG EXPORTS (UNIVERSAL COMPATIBILITY)
// ============================================================================

// Export Firebase services for use in other files
// Use window object for global access in browser environment
if (typeof window !== 'undefined') {
    window.firebaseConfig = firebaseConfig;
    window.firebaseDb = db;
    window.firebaseAuth = auth;
    window.firebaseHandleError = handleFirebaseError;
    
    // Also add to global scope for compatibility
    window.db = db;
    window.auth = auth;
}

// For CommonJS/Node.js environments (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig,
        db,
        auth,
        handleFirebaseError
    };
}

// ============================================================================
// UTILITY FUNCTIONS FOR BRANCH/PATH DETECTION
// ============================================================================

// Function to detect the current branch/path
function detectCurrentPath() {
    const url = window.location.href;
    const path = window.location.pathname;
    
    console.log("🌐 Current URL:", url);
    console.log("📁 Current path:", path);
    
    return {
        url: url,
        path: path,
        isLocalhost: url.includes('localhost') || url.includes('127.0.0.1'),
        isGitHubPages: url.includes('github.io'),
        hasParentPath: path.includes('parent') || path.includes('Parent')
    };
}

// Function to check if Firebase is properly initialized
function isFirebaseInitialized() {
    return typeof firebase !== 'undefined' && 
           firebase.apps && 
           firebase.apps.length > 0 &&
           typeof db !== 'undefined' &&
           typeof auth !== 'undefined';
}

// Initialize path detection
document.addEventListener('DOMContentLoaded', function() {
    const pathInfo = detectCurrentPath();
    console.log("📍 Path detection result:", pathInfo);
    
    // Check Firebase status
    const firebaseStatus = isFirebaseInitialized();
    console.log(`🔥 Firebase status: ${firebaseStatus ? '✅ Initialized' : '❌ Not initialized'}`);
    
    if (!firebaseStatus && !pathInfo.isLocalhost) {
        console.warn("⚠️ Firebase may not be working in this environment");
    }
});

// ============================================================================
// ENVIRONMENT-SPECIFIC OVERRIDES (FOR DIFFERENT BRANCHES/DOMAINS)
// ============================================================================

// You can add environment-specific overrides here
// Example: Different configs for development vs production

function getEnvironmentSpecificConfig() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
        return {
            environment: 'development',
            logLevel: 'debug',
            useEmulators: false // Set to true if using Firebase emulators
        };
    } else if (hostname.includes('github.io')) {
        return {
            environment: 'github-pages',
            logLevel: 'info',
            useEmulators: false
        };
    } else if (hostname.includes('vercel.app') || hostname.includes('netlify.app')) {
        return {
            environment: 'deployment-platform',
            logLevel: 'info',
            useEmulators: false
        };
    } else {
        return {
            environment: 'production',
            logLevel: 'warn',
            useEmulators: false
        };
    }
}

// Apply environment-specific settings
document.addEventListener('DOMContentLoaded', function() {
    const envConfig = getEnvironmentSpecificConfig();
    console.log(`🌍 Environment: ${envConfig.environment}`);
    
    // You can add environment-specific logic here
    // For example, connect to Firebase emulators in development
    if (envConfig.environment === 'development' && envConfig.useEmulators) {
        console.log("🔧 Connecting to Firebase emulators...");
        // Uncomment and configure if using Firebase emulators
        // db.useEmulator('localhost', 8080);
        // auth.useEmulator('http://localhost:9099');
    }
});

console.log("✅ Firebase Parent Configuration loaded successfully");
