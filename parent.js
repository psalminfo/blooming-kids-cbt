// parent.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBpwxvEoeuT8e6F5vGmDc1VkVfWTUdxavY",
  authDomain: "blooming-kids-house.firebaseapp.com",
  projectId: "blooming-kids-house",
  storageBucket: "blooming-kids-house.appspot.com",
  messagingSenderId: "739684305208",
  appId: "1:739684305208:web:ee1cc9e998b37e1f002f84"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById("parentForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentName = document.getElementById("studentName").value.trim();
    const studentEmail = document.getElementById("studentEmail").value.trim().toLowerCase();

    if (!studentName || !studentEmail) {
      alert("Please enter both name and email.");
      return;
    }

    try {
      const resultsRef = collection(db, "student_results");
      const q = query(resultsRef, where("studentName", "==", studentName), where("studentEmail", "==", studentEmail));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const resultDoc = querySnapshot.docs[0].data();

        const reportData = {
          studentName: resultDoc.studentName,
          studentEmail: resultDoc.studentEmail,
          grade: resultDoc.grade,
          score: resultDoc.score,
          tutorName: resultDoc.tutorName || "Mrs. Yinka Isikalu",
          recommendation: resultDoc.recommendation || "Work with the tutor to improve in weak areas."
        };

        localStorage.setItem("reportData", JSON.stringify(reportData));
        window.location.href = "report.html";
      } else {
        alert("No report found for the provided student.");
      }
    } catch (error) {
      console.error("Error fetching student result:", error);
      alert("An error occurred. Please try again later.");
    }
  });
} else {
  console.error("Form not found in the DOM.");
}
