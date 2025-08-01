import { auth, db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('parentForm');
  const errorMsg = document.getElementById('errorMsg');

  if (!form) {
    console.error("Form not found in the DOM.");
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const studentName = document.getElementById('studentName').value.trim();
    const studentEmail = document.getElementById('studentEmail').value.trim().toLowerCase();

    if (!studentName || !studentEmail) {
      errorMsg.textContent = "Please enter both name and email.";
      errorMsg.classList.remove('hidden');
      return;
    }

    try {
      const reportsRef = collection(db, "reports");
      const q = query(reportsRef, where("studentName", "==", studentName), where("studentEmail", "==", studentEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        errorMsg.textContent = "No report found for the provided student.";
        errorMsg.classList.remove('hidden');
        return;
      }

      const reportData = querySnapshot.docs[0].data();
      localStorage.setItem("reportData", JSON.stringify(reportData));
      window.location.href = "report-preview.html";
    } catch (error) {
      console.error("Error fetching report:", error);
      errorMsg.textContent = "Something went wrong. Please try again.";
      errorMsg.classList.remove('hidden');
    }
  });
});
