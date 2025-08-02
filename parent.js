import { db } from './firebaseConfig.js';
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.6.10/firebase-firestore.js";

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

  // Group by test sessions (within 1 hour window)
  studentResults.sort((a, b) => a.submittedAt.seconds - b.submittedAt.seconds);
  const groupedSessions = [];

  let session = [];
  let lastTimestamp = null;
  for (const result of studentResults) {
    const currentTime = result.submittedAt.seconds;
    if (!lastTimestamp || currentTime - lastTimestamp <= 3600) {
      session.push(result);
    } else {
      groupedSessions.push(session);
      session = [result];
    }
    lastTimestamp = currentTime;
  }
  if (session.length) groupedSessions.push(session);

  // Render each session block
  reportContent.innerHTML = "";
  groupedSessions.forEach((sessionResults, index) => {
    const student = sessionResults[0];
    const fullName = capitalize(student.studentName);
    const grade = student.grade;
    const tutorName = student.tutorName;
    const location = student.location;
    const sessionTime = new Date(student.submittedAt.seconds * 1000).toLocaleString();

    // Summary Table
    const scoreRows = sessionResults.map(r => {
      const correct = r.answers.filter(a => a === "correct").length;
      const percentage = ((correct / r.answers.length) * 100).toFixed(1);
      return `<tr><td class="border px-2 py-1">${r.subject.toUpperCase()}</td><td class="border px-2 py-1">${percentage}%</td></tr>`;
    }).join("");

    // Topics Table (if available)
    const topicMap = {};
    sessionResults.forEach(r => {
      r.answers.forEach(ans => {
        if (typeof ans === "object" && ans.topic) {
          if (!topicMap[r.subject]) topicMap[r.subject] = new Set();
          topicMap[r.subject].add(ans.topic);
        }
      });
    });

    const topicSection = Object.keys(topicMap).length > 0 ? `
      <h3 class="font-semibold mt-4 mb-1">Knowledge & Skill Analysis:</h3>
      <table class="w-full mb-4 border text-sm">
        <thead>
          <tr class="bg-gray-100">
            <th class="border px-2 py-1">Subject</th>
            <th class="border px-2 py-1">Topics Covered</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(topicMap).map(([subj, topics]) => `
            <tr>
              <td class="border px-2 py-1">${subj.toUpperCase()}</td>
              <td class="border px-2 py-1">${Array.from(topics).join(", ")}</td>
            </tr>`).join("")}
        </tbody>
      </table>
    ` : "";

    // Recommendations
    const recs = sessionResults.map(r => {
      return `<li><strong>${r.subject.toUpperCase()}</strong>: ${tutorName} recommends focused revision on key concepts in this subject to improve mastery and retention.</li>`;
    }).join("");

    // Report block
    const block = `
      <div id="session-${index}" class="mb-10 p-4 border rounded shadow bg-white">
        <h2 class="text-lg font-bold text-blooming-green mb-1">${fullName}</h2>
        <p class="text-sm text-gray-600 mb-2">${sessionTime}</p>
        <p><strong>Grade:</strong> ${grade}</p>
        <p><strong>Location:</strong> ${location}</p>
        <p><strong>Tutor:</strong> ${tutorName}</p>

        <h3 class="font-semibold mt-4 mb-1">Performance Summary:</h3>
        <table class="w-full mb-4 border text-sm">
          <thead>
            <tr class="bg-gray-100">
              <th class="border px-2 py-1">Subject</th>
              <th class="border px-2 py-1">Score (%)</th>
            </tr>
          </thead>
          <tbody>${scoreRows}</tbody>
        </table>

        ${topicSection}

        <h3 class="font-semibold mt-4 mb-1">Tutor's Recommendation:</h3>
        <ul class="list-disc text-sm pl-5 mb-4">${recs}</ul>

        <h3 class="font-semibold mt-4 mb-1">Director’s Message:</h3>
        <p class="text-sm italic mb-2">
          At Blooming Kids House, we believe every child can grow with the right guidance. We are proud of ${fullName}'s effort and recommend personalized tutoring sessions for greater success.
        </p>
        <p class="text-sm font-semibold text-right">– Mrs. Yinka Isikalu</p>

        <div class="text-center mt-4">
          <button onclick="downloadReport('session-${index}')" class="btn-yellow px-4 py-2 rounded">Download PDF</button>
        </div>
      </div>
    `;
    reportContent.innerHTML += block;
  });

  reportArea.classList.remove("hidden");
}

function capitalize(str) {
  return str.replace(/\b\w/g, l => l.toUpperCase());
}

window.loadReport = loadReport;

window.downloadReport = function (blockId) {
  import("https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js").then(() => {
    const element = document.getElementById(blockId);
    const opt = {
      margin: 0.5,
      filename: `${blockId}_Assessment_Report.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  });
};

window.logout = function () {
  window.location.href = "parent.html";
};
