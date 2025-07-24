// Import the functions you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCt7kk_oCBuftEgHeFhoZU2cPrPROhC6JE",
  authDomain: "bkh-assessments.firebaseapp.com",
  projectId: "bkh-assessments",
  storageBucket: "bkh-assessments.appspot.com",
  messagingSenderId: "86179403579",
  appId: "1:86179403579:web:5295877bb92d0a18f3091e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export Firestore reference and functions
export { db, collection, addDoc, getDocs, query, where };
