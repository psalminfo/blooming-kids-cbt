// ============================================================================
// FIREBASE CONFIGURATION - PARENT PORTAL
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
// FIREBASE INITIALIZATION
// ============================================================================

// Check if Firebase is already initialized to avoid duplicate initialization
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
} else {
    firebase.app(); // if already initialized, use that instance
}

// ============================================================================
// FIREBASE SERVICE REFERENCES
// ============================================================================

const db = firebase.firestore();
const auth = firebase.auth();

// Enable Firestore offline persistence (optional but recommended)
db.enablePersistence().catch((err) => {
    console.warn("Firestore persistence failed:", err.code);
});

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
        'not-found': 'The requested data was not found.'
    };
    
    return errorMessages[error.code] || error.message || 'An unknown Firebase error occurred.';
}

// ============================================================================
// FIREBASE CONFIG EXPORTS
// ============================================================================

// Export Firebase services for use in other files
window.firebaseConfig = firebaseConfig;
window.firebaseDb = db;
window.firebaseAuth = auth;
window.firebaseHandleError = handleFirebaseError;

console.log("✅ Firebase Parent Configuration loaded successfully");
