// parent.js

import { db } from './firebaseParentConfig.js'; // using separate config for parent portal
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js";

// Form submission handler
const parentForm = document.getElementById("parent-login-form");

parentForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const parentEmail = document.getElementById("parent-email").value.trim();
  const studentName = document.getElementById("student-name").value.trim();

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  // Save to sessionStorage
  sessionStorage.setItem("studentName", studentName);
  sessionStorage.setItem("parentEmail", parentEmail);

  // 🔍 Debug: See what's being searched
  console.log("🔍 Searching Firestore for:");
  console.log("studentName:", studentName);
  console.log("parentEmail:", parentEmail);

  try {
    const resultsRef = collection(db, "student_results");

    const q = query(
      resultsRef,
      where("studentName", "==", studentName),
      where("parentEmail", "==", parentEmail)
    );

    const snapshot = await getDocs(q);

    // 🔍 Debug: Log results if found
    if (snapshot.empty) {
      console.warn("No matching document found.");
      alert("No report found for this student and parent email.");
      return;
    }

    const studentData = snapshot.docs[0].data();
    console.log("✅ Found student record:", studentData);

    sessionStorage.setItem("studentData", JSON.stringify(studentData));

    // Redirect to report page
    window.location.href = "report.html";
  } catch (error) {
    console.error("🔥 Error fetching report:", error);
    alert("An error occurred while retrieving the student report.");
  }
});
