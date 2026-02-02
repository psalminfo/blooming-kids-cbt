import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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

// --- 3. THE SMART SWITCH ---
const hostname = window.location.hostname;

// This checks if you are coding locally OR viewing your new Netlify dev link
const isDevelopment = 
    hostname === "localhost" || 
    hostname === "127.0.0.1" || 
    hostname.includes("bkhdevelop.netlify.app");

const firebaseConfig = isDevelopment ? devConfig : mainConfig;

// --- 4. INITIALIZE ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Logic check for your console so you know it's working
console.log("Environment:", isDevelopment ? "🛠️ DEVELOPMENT" : "🚀 PRODUCTION");

export { db, storage, auth, firebaseConfig };
