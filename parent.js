// parent.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { firebaseConfig } from "./firebaseConfig.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

document.getElementById("parentLoginForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("studentName").value.trim();
  const studentEmail = document.getElementById("studentEmail").value.trim();

  if (!studentName || !studentEmail) {
    alert("Please enter both name and email.");
    return;
  }

  try {
    const reportsRef = collection(db, "studentResults");
    const q = query(reportsRef, where("studentEmail", "==", studentEmail), where("studentName", "==", studentName));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Assume the latest report is fine
      const doc = querySnapshot.docs[0];
      const data = doc.data();

      // Save all relevant report data to localStorage
      localStorage.setItem("reportData", JSON.stringify({
        studentName: data.studentName,
        studentEmail: data.studentEmail,
        grade: data.grade,
        score: data.score,
        tutorName: data.tutorName || "Your child's assigned tutor",
        recommendation: data.recommendation || "We recommend personalized tutoring to help improve academic progress."
      }));

      window.location.href = "report.html";
    } else {
      alert("No report found for that student.");
    }
  } catch (error) {
    console.error("Error fetching report:", error);
    alert("An error occurred while trying to fetch the report.");
  }
});
