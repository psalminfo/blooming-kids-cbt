import { db } from './firebaseConfig.js';
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

async function loadReport() {
  const studentName = document.getElementById("studentName").value.trim().toLowerCase();
  const parentEmail = document.getElementById("parentEmail").value.trim().toLowerCase();
  const reportArea = document.getElementById("reportArea");
  const reportContent = document.getElementById("reportContent");

  if (!studentName || !parentEmail) {
    alert("Please enter both student name and parent email.");
    return;
  }

  const q = query(collection(db, "student_results"), where("parentEmail", "==", parentEmail));
  const querySnapshot = await getDocs(q);

  const studentResults = [];
  querySnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.studentName.toLowerCase() === studentName) {
      studentResults.push(data);
    }
  });

  if (studentResults.length === 0) {
    alert("No records found.");
    return;
  }

  // Group results by timestamp session
  const grouped = {};
  studentResults.forEach(result => {
    const ts = result.submittedAt?.seconds || 0;
    if (!grouped[ts]) grouped[ts] = [];
    grouped[ts].push(result);
  });

  // Render sessions
  reportContent.innerHTML = "";
  Object.entries(grouped).sort((a, b) => b[0] - a[0]).forEach(([timestamp, results], index) => {
    const sessionDate = new Date(timestamp * 1000).toLocaleString();
    const student = results[0];

    const subjectRows = results.map(r => {
      const correct = r.answers.filter(a => a === "correct").length;
      const total = r.answers.length;
      const percentage = ((correct / total) * 100).toFixed(1);
      return `<tr><td class='border px-4 py-2'>${r.subject.toUpperCase()}</td><td class='border px-4 py-2'>${percentage}%</td></tr>`;
    }).join("");

    const recommendations = results.map(r => {
      const topics = r.topicsCovered?.join(", ") || "key concepts from the assessment";
      return `<li><strong>${r.subject.toUpperCase()}:</strong> Focus on ${topics} for improved mastery.</li>`;
    }).join("");

    const sessionId = `session-${timestamp}`;
    reportContent.innerHTML += `
      <div class="bg-white shadow p-6 mb-8 rounded-xl" id="${sessionId}">
        <h2 class="text-xl font-bold mb-1">Blooming Kids House Assessment Report</h2>
        <p><strong>Student:</strong> ${capitalize(student.studentName)}</p>
        <p><strong>Grade:</strong> ${student.grade}</p>
        <p><strong>Tutor:</strong> ${student.tutorName}</p>
        <p><strong>Location:</strong> ${student.location}</p>
        <p><strong>Date:</strong> ${sessionDate}</p>

        <h3 class="mt-4 font-semibold">Subject Scores</h3>
        <table class="table-auto w-full border my-2">
          <thead>
            <tr class="bg-gray-200">
              <th class="px-4 py-2 border">Subject</th>
              <th class="px-4 py-2 border">Score (%)</th>
            </tr>
          </thead>
          <tbody>${subjectRows}</tbody>
        </table>

        <h3 class="mt-4 font-semibold">Recommendations</h3>
        <ul class="list-disc pl-5 mb-4">${recommendations}</ul>

        <h3 class="font-semibold">Director's Message</h3>
        <p class="italic mb-2">Thank you for trusting Blooming Kids House. We recommend personalized tutoring to reinforce learning. Your child will be supported by ${student.tutorName} to boost performance and confidence.</p>
        <p><strong>– Mrs. Yinka Isikalu, Director</strong></p>

        <button onclick="downloadSessionReport('${sessionId}')" class="mt-4 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-xl">Download PDF</button>
      </div>
    `;
  });

  reportArea.classList.remove("hidden");
}

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

window.loadReport = loadReport;

window.downloadSessionReport = function (id) {
  import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js").then(() => {
    const element = document.getElementById(id);
    html2pdf().from(element).save("Assessment_Report.pdf");
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
