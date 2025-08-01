import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById("parentLoginForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentName = document.getElementById("studentNameInput").value.trim();
    const parentEmail = document.getElementById("parentEmailInput").value.trim();

    if (!studentName || !parentEmail) {
      alert("Please fill out all fields.");
      return;
    }

    try {
      const resultsRef = collection(db, "student_results");
      const q = query(resultsRef, where("studentName", "==", studentName));

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No report found for the provided student.");
        return;
      }

      let reportData = null;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.parentEmail === parentEmail) {
          reportData = {
            studentName: data.studentName,
            studentEmail: data.studentEmail,
            grade: data.grade,
            score: data.score,
            tutorName: data.tutorName || "Assigned Tutor",
            recommendation: data.recommendation || "Keep working hard!"
          };
        }
      });

      if (!reportData) {
        alert("No matching report found for that parent email.");
        return;
      }

      localStorage.setItem("studentReportData", JSON.stringify(reportData));
      window.location.href = "report.html";
    } catch (err) {
      console.error("Error fetching student report:", err);
      alert("An error occurred. Please try again.");
    }
  });
} else {
  console.warn("Form not found in the DOM.");
}
