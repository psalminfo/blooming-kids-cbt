// parent.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("parentLoginForm");

  if (!form) {
    console.error("Form not found in the DOM.");
    return;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentName = document.getElementById("studentName").value.trim();
    const parentEmail = document.getElementById("parentEmail").value.trim();

    if (!studentName || !parentEmail) {
      alert("Please fill in both fields.");
      return;
    }

    try {
      const resultsRef = collection(db, "student_results");
      const q = query(
        resultsRef,
        where("studentName", "==", studentName),
        where("parentEmail", "==", parentEmail)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No report found for the provided student.");
        return;
      }

      const doc = querySnapshot.docs[0];
      const resultData = doc.data();

      const report = {
        studentName: resultData.studentName,
        grade: resultData.grade,
        parentEmail: resultData.parentEmail,
        scores: resultData.scores,
        tutor: resultData.tutorName || "Assigned Tutor",
      };

      localStorage.setItem("studentReportData", JSON.stringify(report));
      window.location.href = "report.html";

    } catch (err) {
      console.error("Error fetching report:", err);
      alert("An error occurred while fetching the report.");
    }
  });
});
