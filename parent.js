import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config (already provided and correct)
const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Wait for DOM content
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reportForm");

  if (!form) {
    console.error("Form not found in the DOM.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentName = document.getElementById("studentName").value.trim();
    const studentEmail = document.getElementById("studentEmail").value.trim().toLowerCase();

    if (!studentName || !studentEmail) {
      alert("Please enter both student name and email.");
      return;
    }

    try {
      const q = query(
        collection(db, "student_results"),
        where("studentName", "==", studentName),
        where("studentEmail", "==", studentEmail)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No report found for the provided student.");
        return;
      }

      // Only use the first matching result
      const docData = querySnapshot.docs[0].data();

      // Store student info in sessionStorage and redirect
      sessionStorage.setItem("studentData", JSON.stringify(docData));
      window.location.href = "report.html";

    } catch (error) {
      console.error("Error fetching report:", error);
      alert("An error occurred while fetching the report.");
    }
  });
});
