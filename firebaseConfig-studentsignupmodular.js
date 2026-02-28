// firebaseConfig-studentsignupmodular.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Your EXACT Firebase configs (copy from your existing file)
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

const hostname = window.location.hostname;
const isDevelopment = 
    hostname === "localhost" || 
    hostname === "127.0.0.1" || 
    hostname.includes("bkhdevelop.netlify.app");

const firebaseConfig = isDevelopment ? devConfig : mainConfig;

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export for use
export const db = getFirestore(app);
export const auth = getAuth(app);

console.log("Student Signup - Environment:", isDevelopment ? "🛠️ DEVELOPMENT" : "🚀 PRODUCTION");
