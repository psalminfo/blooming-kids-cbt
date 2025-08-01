// parent.js

import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const parentForm = document.getElementById("parent-login-form");

parentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const parentEmail = document.getElementById("parent-email").value;
  const studentName = document.getElementById("student-name").value;

  if (!parentEmail || !studentName) {
    alert("Please enter both student name and parent email.");
    return;
  }

  // Save data to sessionStorage
  sessionStorage.setItem("studentName", studentName);
  sessionStorage.setItem("parentEmail", parentEmail);

  try {
    const resultsRef = collection(db, "student_results");
    const q = query(resultsRef, where("studentName", "==", studentName));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      alert("No report found for this student.");
      return;
    }

    // Save first match for simplicity
    const studentData = snapshot.docs[0].data();
    sessionStorage.setItem("studentData", JSON.stringify(studentData));

    window.location.href = "report.html";
  } catch (error) {
    console.error("Error fetching report:", error);
    alert("An error occurred while fetching the report.");
  }
});
