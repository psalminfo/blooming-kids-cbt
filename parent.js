import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, collection, query, where, getDocs, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

window.fetchReports = async function () {
  const studentName = document.getElementById("studentName").value.trim();
  const parentEmail = document.getElementById("parentEmail").value.trim();
  const reportContainer = document.getElementById("reportContainer");

  reportContainer.innerHTML = "";

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const reportsRef = collection(db, "reports");
  const q = query(
    reportsRef,
    where("studentName", "==", studentName),
    where("parentEmail", "==", parentEmail),
    orderBy("timestamp", "desc")
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    reportContainer.innerHTML = "<p class='text-red-600'>No reports found.</p>";
    return;
  }

  const doc = querySnapshot.docs[0].data(); // Latest report only

  const scoreTable = Object.entries(doc.scores)
    .map(([subject, score]) => {
      const percentage = ((score.correct / score.total) * 100).toFixed(1);
      return `<tr><td class="border px-4 py-2 font-semibold">${subject}</td><td class="border px-4 py-2">${percentage}%</td></tr>`;
    })
    .join("");

  const recommendations = Object.entries(doc.recommendations || {})
    .map(([subject, tip]) => {
      return `<div class="mb-3"><strong>${subject}:</strong> ${tip}</div>`;
    })
    .join("");

  const html = `
    <div id="report" class="bg-white shadow-md rounded p-4">
      <h2 class="text-xl font-bold mb-2">Student Report</h2>
      <p><strong>Name:</strong> ${doc.studentName}</p>
      <p><strong>Grade:</strong> ${doc.grade}</p>
      <p><strong>Tutor:</strong> ${doc.tutorName || 'N/A'}</p>
      <h3 class="mt-4 font-bold">Scores</h3>
      <table class="w-full border mt-2 mb-4">
        <thead>
          <tr><th class="border px-4 py-2 text-left">Subject</th><th class="border px-4 py-2 text-left">Score</th></tr>
        </thead>
        <tbody>${scoreTable}</tbody>
      </table>
      <h3 class="font-bold">Recommendations</h3>
      <div class="mb-4">${recommendations || 'No recommendations available.'}</div>

      <div class="mt-6">
        <h3 class="font-bold text-lg">Director’s Message</h3>
        <p class="mt-2">Thank you for trusting us with your child's learning. We are committed to helping them grow academically and personally. Please contact us for next steps.</p>
        <p class="mt-2 italic">— Mrs. Yinka Isikalu, Director</p>
      </div>

      <div class="mt-6 text-sm text-gray-500">
        POWERED BY <span style="color:#FFEB3B">POG</span>
      </div>

      <button onclick="downloadPDF()" class="mt-4 bg-green-600 text-white px-4 py-2 rounded">Download PDF</button>
    </div>
  `;

  reportContainer.innerHTML = html;
};

window.downloadPDF = function () {
  const element = document.getElementById("report");
  const opt = {
    margin: 0.5,
    filename: 'student-report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
  };
  html2pdf().set(opt).from(element).save();
};
