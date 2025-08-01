// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Handle parent login
document.getElementById("parentLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();

  if (!studentName || !parentEmail) {
    alert("Please fill in both fields.");
    return;
  }

  try {
    const q = query(
      collection(db, "studentsAnswers"),
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail)
    );

    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Valid record found — redirect to report
      const encodedName = encodeURIComponent(studentName);
      const encodedEmail = encodeURIComponent(parentEmail);
      window.location.href = `report.html?name=${encodedName}&email=${encodedEmail}`;
    } else {
      alert("No matching student record found. Please check the name and email.");
    }
  } catch (error) {
    console.error("Error checking student record:", error);
    alert("An error occurred while verifying. Please try again.");
  }
});
