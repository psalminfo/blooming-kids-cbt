// parent.js
import { db } from './firebaseParentConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js";

// Form handling (unchanged)
const parentForm = document.getElementById("parent-login-form");

parentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const parentEmail = document.getElementById("parent-email").value.trim();
  const studentName = document.getElementById("student-name").value.trim();

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  sessionStorage.setItem("studentName", studentName);
  sessionStorage.setItem("parentEmail", parentEmail);

  try {
    const resultsRef = collection(db, "student_results"); // ✅ MATCHES YOUR FIRESTORE
    const q = query(
      resultsRef,
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("No report found for this student and parent email.");
      return;
    }

    const studentData = snapshot.docs[0].data();
    sessionStorage.setItem("studentData", JSON.stringify(studentData));

    window.location.href = "report.html";
  } catch (error) {
    console.error("Error fetching report:", error);
    alert("An error occurred while retrieving the student report.");
  }
});
