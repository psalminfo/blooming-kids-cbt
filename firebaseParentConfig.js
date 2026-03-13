// ============================================================================
// FIREBASE CONFIGURATION - PARENT PORTAL (UPDATED WITH DUAL CONFIGS)
// ============================================================================

// --- 1. PRODUCTION CONFIG (Live Site) ---
const mainConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// --- 2. DEVELOPMENT CONFIG (Your New Dev Project) ---
const devConfig = {
    apiKey: "AIzaSyAu36oLPNsk0TPKVIwCzEHe9oOtJ7cZQXA",
    authDomain: "blooming-kids-dev.firebaseapp.com",
    projectId: "blooming-kids-dev",
    storageBucket: "blooming-kids-dev.firebasestorage.app",
    messagingSenderId: "336022609689",
    appId: "1:336022609689:web:ad5a0a74dcac011f21ef88"
};

// --- 3. THE SMART SWITCH (Automatic Environment Detection) ---
const hostname = window.location.hostname;
const isDevelopment = 
    hostname === "localhost" || 
    hostname === "127.0.0.1" || 
    hostname.includes("bkhdevelop.netlify.app") ||
    hostname.includes("dev.") ||  // Add any dev subdomains
    hostname.includes("staging."); // Add staging if needed

const firebaseConfig = isDevelopment ? devConfig : mainConfig;

console.log("🌍 Environment:", isDevelopment ? "🛠️ DEVELOPMENT" : "🚀 PRODUCTION");
console.log("🔧 Using config:", isDevelopment ? "Dev Project" : "Live Project");

// ============================================================================
// FIREBASE INITIALIZATION (ENHANCED)
// ============================================================================

// Enhanced initialization to work in all environments
try {
    // Check if Firebase is already initialized
    if (typeof firebase !== 'undefined') {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log(`✅ Firebase initialized for ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'} environment`);
        } else {
            console.log("ℹ️ Firebase already initialized, using existing instance");
            // Check if it's using the right config
            const currentApp = firebase.app();
            console.log("📋 Current Firebase project:", currentApp.options.projectId);
        }
    } else {
        console.error("❌ Firebase SDK not loaded");
        // Create a placeholder to prevent errors
        window.firebase = { 
            apps: [], 
            app: () => ({ 
                options: { projectId: isDevelopment ? devConfig.projectId : mainConfig.projectId },
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
        
        console.log(`🔥 Firebase services ready for project: ${firebase.app().options.projectId}`);
    } else {
        console.warn("⚠️ Firebase not available, creating dummy services");
        // Create dummy services with environment info
        db = {
            collection: () => ({ 
                get: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)),
                doc: () => ({ 
                    get: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)),
                    set: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)),
                    update: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`))
                }),
                where: () => ({ get: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)) })
            }),
            batch: () => ({ 
                update: () => {},
                commit: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`))
            })
        };
        
        auth = {
            onAuthStateChanged: () => {},
            signOut: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)),
            signInWithEmailAndPassword: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)),
            createUserWithEmailAndPassword: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)),
            sendPasswordResetEmail: () => Promise.reject(new Error(`Firebase not initialized (${isDevelopment ? 'Dev Mode' : 'Prod Mode'})`)),
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
    
    // Add environment context to error message
    const envContext = isDevelopment ? " (Development Environment)" : " (Production Environment)";
    
    const errorMessages = {
        'permission-denied': `You do not have permission to access this data.${envContext}`,
        'unavailable': `Firebase service is unavailable. Please check your connection.${envContext}`,
        'failed-precondition': `Database operation failed. Please try again.${envContext}`,
        'not-found': `The requested data was not found.${envContext}`,
        'auth/user-not-found': `No account found with this email.${envContext}`,
        'auth/wrong-password': `Incorrect password.${envContext}`,
        'auth/invalid-email': `Invalid email address format.${envContext}`,
        'auth/email-already-in-use': `This email is already registered.${envContext}`,
        'auth/too-many-requests': `Too many failed attempts. Please try again later.${envContext}`,
        'auth/weak-password': `Password should be at least 6 characters.${envContext}`
    };
    
    return errorMessages[error.code] || error.message || `An unknown Firebase error occurred.${envContext}`;
}

// ============================================================================
// FIREBASE CONFIG EXPORTS (UNIVERSAL COMPATIBILITY)
// ============================================================================

// Export Firebase services for use in other files
// Use window object for global access in browser environment
if (typeof window !== 'undefined') {
    // Export configs
    window.firebaseMainConfig = mainConfig;
    window.firebaseDevConfig = devConfig;
    window.firebaseConfig = firebaseConfig;
    
    // Export services
    window.firebaseDb = db;
    window.firebaseAuth = auth;
    window.firebaseHandleError = handleFirebaseError;
    
    // Also add to global scope for compatibility
    window.db = db;
    window.auth = auth;
    
    // Export environment info
    window.firebaseEnv = {
        isDevelopment: isDevelopment,
        hostname: hostname,
        projectId: firebaseConfig.projectId,
        getConfigType: () => isDevelopment ? 'development' : 'production'
    };
}

// For CommonJS/Node.js environments (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        mainConfig,
        devConfig,
        firebaseConfig,
        db,
        auth,
        handleFirebaseError,
        isDevelopment,
        hostname
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
        isLocalhost: hostname === 'localhost' || hostname === '127.0.0.1',
        isDevelopment: isDevelopment,
        isProduction: !isDevelopment,
        isGitHubPages: url.includes('github.io'),
        hasParentPath: path.includes('parent') || path.includes('Parent'),
        firebaseProject: firebaseConfig.projectId
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

// Function to manually switch environments (for testing)
function switchFirebaseEnvironment(useDev) {
    console.warn(`🔄 Manual environment switch to: ${useDev ? 'DEVELOPMENT' : 'PRODUCTION'}`);
    console.warn("Note: This requires page reload to take full effect");
    
    // Store preference in localStorage
    localStorage.setItem('firebaseEnvOverride', useDev ? 'dev' : 'prod');
    
    return {
        success: true,
        message: `Switched to ${useDev ? 'development' : 'production'} mode. Page reload recommended.`,
        currentEnv: useDev ? 'development' : 'production',
        projectId: useDev ? devConfig.projectId : mainConfig.projectId
    };
}

// Initialize path detection
document.addEventListener('DOMContentLoaded', function() {
    const pathInfo = detectCurrentPath();
    console.log("📍 Path detection result:", pathInfo);
    
    // Check Firebase status
    const firebaseStatus = isFirebaseInitialized();
    console.log(`🔥 Firebase status: ${firebaseStatus ? '✅ Initialized' : '❌ Not initialized'}`);
    console.log(`🎯 Target project: ${firebaseConfig.projectId}`);
    
    if (!firebaseStatus && !pathInfo.isLocalhost) {
        console.warn("⚠️ Firebase may not be working in this environment");
    }
    
    // Check for manual override
    const envOverride = localStorage.getItem('firebaseEnvOverride');
    if (envOverride) {
        console.log(`⚙️ Environment override detected: ${envOverride}`);
        console.log(`   Actual environment: ${isDevelopment ? 'dev' : 'prod'}`);
        if ((envOverride === 'dev' && !isDevelopment) || (envOverride === 'prod' && isDevelopment)) {
            console.warn("   ⚠️ Override doesn't match current environment. Clear localStorage or reload page.");
        }
    }
});

// ============================================================================
// ENVIRONMENT-SPECIFIC OVERRIDES (FOR DIFFERENT BRANCHES/DOMAINS)
// ============================================================================

// You can add environment-specific overrides here
// Example: Different configs for development vs production

function getEnvironmentSpecificConfig() {
    if (isDevelopment) {
        return {
            environment: 'development',
            logLevel: 'debug',
            useEmulators: false, // Set to true if using Firebase emulators
            config: devConfig,
            features: {
                debugLogging: true,
                mockData: true,
                analytics: false
            }
        };
    } else {
        return {
            environment: 'production',
            logLevel: 'warn',
            useEmulators: false,
            config: mainConfig,
            features: {
                debugLogging: false,
                mockData: false,
                analytics: true
            }
        };
    }
}

// Apply environment-specific settings
document.addEventListener('DOMContentLoaded', function() {
    const envConfig = getEnvironmentSpecificConfig();
    console.log(`🌍 Environment: ${envConfig.environment}`);
    console.log(`📊 Project ID: ${envConfig.config.projectId}`);
    
    // You can add environment-specific logic here
    // For example, connect to Firebase emulators in development
    if (envConfig.environment === 'development' && envConfig.useEmulators) {
        console.log("🔧 Connecting to Firebase emulators...");
        // Uncomment and configure if using Firebase emulators
        // db.useEmulator('localhost', 8080);
        // auth.useEmulator('http://localhost:9099');
    }
    
    // Apply feature flags based on environment
    if (envConfig.features.debugLogging) {
        console.log("🔍 Debug logging enabled for development");
    }
});

console.log("✅ Firebase Parent Configuration loaded successfully");
console.log("⚙️ Mode:", isDevelopment ? "DEVELOPMENT" : "PRODUCTION");
console.log("🏢 Project:", firebaseConfig.projectId);
