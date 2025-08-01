import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.7.2/firebase-firestore.js";

// ✅ Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ Handle form submission
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("parentLoginForm");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentName = document.getElementById("studentName").value.trim();
    const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();

    if (!studentName || !parentEmail) {
      alert("Please enter both student name and parent email.");
      return;
    }

    try {
      const resultsRef = collection(db, "testResults");
      const q = query(
        resultsRef,
        where("studentName", "==", studentName),
        where("parentEmail", "==", parentEmail)
      );

      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // ✅ Found a result, redirect to report page with query params
        window.location.href = `report.html?student=${encodeURIComponent(studentName)}&parent=${encodeURIComponent(parentEmail)}`;
      } else {
        alert("No report found for this student and parent email.");
      }
    } catch (error) {
      console.error("Error fetching report:", error);
      alert("An error occurred. Please try again later.");
    }
  });
});
