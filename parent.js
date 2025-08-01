// parent.js

import { getFirestore, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-lite.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// Use your own config here (copied from your message)
const firebaseConfig = {
  apiKey: "AIzaSyD1lJhsWMMs_qerLBSzk7wKhjLyI_11RJg",
  authDomain: "bloomingkidsassessment.firebaseapp.com",
  projectId: "bloomingkidsassessment",
  storageBucket: "bloomingkidsassessment.appspot.com",
  messagingSenderId: "238975054977",
  appId: "1:238975054977:web:87c70b4db044998a204980"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Handle parent login form
document.getElementById("parent-login-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const studentName = document.getElementById("student-name").value.trim();
  const parentEmail = document.getElementById("parent-email").value.trim();

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  try {
    const resultsRef = collection(db, "student_results"); // ✅ fixed collection name
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
    sessionStorage.setItem("studentName", studentName);
    sessionStorage.setItem("parentEmail", parentEmail);

    window.location.href = "report.html";
  } catch (error) {
    console.error("Error fetching report:", error);
    alert("An error occurred while retrieving the student report.");
  }
});
