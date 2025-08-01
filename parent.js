// parent.js
import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from 'https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js';

document.addEventListener("DOMContentLoaded", () => {
  const reportForm = document.getElementById("reportForm");
  const reportResult = document.getElementById("reportResult");

  reportForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const studentName = document.getElementById("studentName").value.trim().toLowerCase();
    const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();

    reportResult.innerHTML = "⏳ Fetching report...";

    try {
      const resultsRef = collection(db, "student_results");
      const q = query(
        resultsRef,
        where("studentName", "==", studentName),
        where("parentEmail", "==", parentEmail)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        reportResult.innerHTML = "❌ No report found for this student and parent email.";
        return;
      }

      let reportHTML = `<div class="text-left">`;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        reportHTML += `
          <div class="border rounded p-4 my-4 bg-gray-50">
            <p><strong>Student:</strong> ${data.studentName}</p>
            <p><strong>Subject:</strong> ${data.subject}</p>
            <p><strong>Score:</strong> ${data.score}</p>
            <p><strong>Grade:</strong> ${data.grade}</p>
            <a href="${data.reportUrl}" target="_blank" class="text-blue-600 underline">Download Report</a>
          </div>
        `;
      });
      reportHTML += `</div>`;
      reportResult.innerHTML = reportHTML;

    } catch (error) {
      console.error("Error fetching report:", error);
      reportResult.innerHTML = "🚨 An error occurred. Please try again later.";
    }
  });
});
