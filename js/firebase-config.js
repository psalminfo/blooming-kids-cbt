// js/firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
export const db = getFirestore(app);
