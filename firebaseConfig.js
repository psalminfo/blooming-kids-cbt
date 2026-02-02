import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// --- 1. PRODUCTION CONFIG (Blooming Kids) ---
const mainConfig = {
    apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
    authDomain: "bloomingkidsassessment.firebaseapp.com",
    projectId: "bloomingkidsassessment",
    storageBucket: "bloomingkidsassessment.appspot.com",
    messagingSenderId: "238975054977",
    appId: "1:238975054977:web:87c70b4db044998a204980"
};

// --- 2. DEVELOPMENT CONFIG (The keys you just gave me) ---
const devConfig = {
    apiKey: "AIzaSyAu36oLPNsk0TPKVIwCzEHe9oOtJ7cZQXA",
    authDomain: "blooming-kids-dev.firebaseapp.com",
    projectId: "blooming-kids-dev",
    storageBucket: "blooming-kids-dev.firebasestorage.app",
    messagingSenderId: "336022609689",
    appId: "1:336022609689:web:ad5a0a74dcac011f21ef88"
};

// --- 3. THE SMART SWITCH ---
const hostname = window.location.hostname;

// Logic: Use Dev project if on localhost OR your specific dev Netlify URL
const isDevelopment = 
    hostname === "localhost" || 
    hostname === "127.0.0.1" || 
    hostname.includes("dev-site-name.netlify.app"); // <-- Put your NEW Netlify URL here

const firebaseConfig = isDevelopment ? devConfig : mainConfig;

// --- 4. INITIALIZE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

export { db, storage, auth, firebaseConfig };
